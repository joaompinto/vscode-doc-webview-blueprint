/*---------------------------------------------------------------------------------------------
  *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

import { WebviewContentProvider } from './WebviewContentProvider';
import { disposeAll } from '../util/dispose';

import * as nls from 'vscode-nls';
import { getVisibleLine, MyDocFileTopmostLineMonitor } from '../util/topmostLineMonitor';
import { isMyDocFile } from '../util/file';
const localize = nls.loadMessageBundle();

export class WebviewPreview
{

  public static viewType = 'MyDoc.preview';

  private _resource: vscode.Uri;

  private readonly editor: vscode.WebviewPanel;
  private throttleTimer: any;
  private line: number | undefined = undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private firstUpdate = true;
  private currentVersion?: { resource: vscode.Uri, version: number };
  private forceUpdate = false;
  private isScrolling = false;
  private _disposed: boolean = false;
  private imageInfo: { id: string, width: number, height: number }[] = [];

  public static async revive(
    webview: vscode.WebviewPanel,
    state: any,
    contentProvider: WebviewContentProvider,
    topmostLineMonitor: MyDocFileTopmostLineMonitor
  ): Promise<WebviewPreview>
  {
    const resource = vscode.Uri.parse(state.resource);
    const line = state.line;
    const preview = new WebviewPreview(
      webview,
      resource,
      contentProvider,
      topmostLineMonitor
      );

    if (!isNaN(line))
    {
      preview.line = line;
    }
    await preview.doUpdate();
    return preview;
  }

  public static create(
    resource: vscode.Uri,
    previewColumn: vscode.ViewColumn,
    contentProvider: WebviewContentProvider,
    topmostLineMonitor: MyDocFileTopmostLineMonitor
  ): WebviewPreview
  {
    const webview = vscode.window.createWebviewPanel(
      WebviewPreview.viewType,
      WebviewPreview.getPreviewTitle(resource),
      previewColumn, {
      enableFindWidget: true,
      ...WebviewPreview.getWebviewOptions(resource),
    });

    return new WebviewPreview(
      webview,
      resource,
      contentProvider,
      topmostLineMonitor
      );
  }

  private constructor(
    webview: vscode.WebviewPanel,
    resource: vscode.Uri,
    private readonly _contentProvider: WebviewContentProvider,
    topmostLineMonitor: MyDocFileTopmostLineMonitor
  )
  {
    this._resource = resource;
    this.editor = webview;

    this.editor.onDidDispose(() =>
    {
      this.dispose();
    }, null, this.disposables);

    this.editor.onDidChangeViewState((e) =>
    {
      this._onDidChangeViewStateEmitter.fire(e);
    }, null, this.disposables);

    this.editor.webview.onDidReceiveMessage((e) =>
    {
      if (e.source !== this._resource.toString())
      {
        return;
      }

      switch (e.type)
      {
        case 'cacheImageSizes':
          this.onCacheImageSizes(e.body);
          break;

        case 'revealLine':
          this.onDidScrollPreview(e.body.line);
          break;

        case 'didClick':
          this.onDidClickPreview(e.body.line);
          break;

        case 'clickLink':
          this.onDidClickPreviewLink(e.body.path, e.body.fragement);
          break;

        case 'previewStyleLoadError':
          vscode.window.showWarningMessage(localize('onPreviewStyleLoadError', "Could not load 'MyDoc.styles': {0}", e.body.unloadedStyles.join(', ')));
          break;
      }
    }, null, this.disposables);

    vscode.workspace.onDidChangeTextDocument((event) =>
    {
      if (this.isPreviewOf(event.document.uri))
      {
        this.refresh();
      }
    }, null, this.disposables);

    topmostLineMonitor.onDidChangeTopmostLine((event) =>
    {
      if (this.isPreviewOf(event.resource))
      {
        this.updateForView(event.resource, event.line);
      }
    }, null, this.disposables);

    vscode.window.onDidChangeTextEditorSelection((event) =>
    {
      if (this.isPreviewOf(event.textEditor.document.uri))
      {
        this.postMessage({
          type: 'onDidChangeTextEditorSelection',
          line: event.selections[0].active.line,
          source: this.resource.toString(),
        });
      }
    }, null, this.disposables);

    vscode.window.onDidChangeActiveTextEditor((editor) =>
    {
      if (editor && isMyDocFile(editor.document))
      {
        this.update(editor.document.uri);
      }
    }, null, this.disposables);
  }

  private readonly _onDisposeEmitter = new vscode.EventEmitter<void>();
  public readonly onDispose = this._onDisposeEmitter.event;

  private readonly _onDidChangeViewStateEmitter = new vscode.EventEmitter<vscode.WebviewPanelOnDidChangeViewStateEvent>();
  public readonly onDidChangeViewState = this._onDidChangeViewStateEmitter.event;

  public get resource(): vscode.Uri
  {
    return this._resource;
  }

  public get state()
  {
    return {
      resource: this.resource.toString(),
      line: this.line,
      imageInfo: this.imageInfo,
    };
  }

  public dispose()
  {
    if (this._disposed)
    {
      return;
    }

    this._disposed = true;
    this._onDisposeEmitter.fire();

    this._onDisposeEmitter.dispose();
    this._onDidChangeViewStateEmitter.dispose();
    this.editor.dispose();

    disposeAll(this.disposables);
  }

  public update(resource: vscode.Uri)
  {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.fsPath === resource.fsPath)
    {
      this.line = getVisibleLine(editor);
    }

    // If we have changed resources, cancel any pending updates
    const isResourceChange = resource.fsPath !== this._resource.fsPath;
    if (isResourceChange)
    {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = undefined;
    }

    this._resource = resource;

    // Schedule update if none is pending
    if (!this.throttleTimer)
    {
      if (isResourceChange || this.firstUpdate)
      {
        this.doUpdate();
      } else
      {
        this.throttleTimer = setTimeout(() => this.doUpdate(), 300);
      }
    }

    this.firstUpdate = false;
  }

  public refresh()
  {
    this.forceUpdate = true;
    this.update(this._resource);
  }


  public get position(): vscode.ViewColumn | undefined
  {
    return this.editor.viewColumn;
  }

  public matchesResource(
    otherPosition: vscode.ViewColumn | undefined
  ): boolean
  {
    if (this.position !== otherPosition)
    {
      return false;
    }
    return true;

  }

  public matches(otherPreview: WebviewPreview): boolean
  {
    return this.matchesResource( otherPreview.position);
  }

  public reveal(viewColumn: vscode.ViewColumn)
  {
    this.editor.reveal(viewColumn);
  }


  private isPreviewOf(resource: vscode.Uri): boolean
  {
    return this._resource.fsPath === resource.fsPath;
  }

  private static getPreviewTitle(resource: vscode.Uri): string
  {
    return localize('previewTitle', 'Preview {0}', path.basename(resource.fsPath));
  }

  private updateForView(resource: vscode.Uri, topLine: number | undefined)
  {

    if (!this.isPreviewOf(resource))
    {
      return;
    }

    if (this.isScrolling)
    {
      this.isScrolling = false;
      return;
    }

    if (typeof topLine === 'number')
    {
      this.line = topLine;
      this.postMessage({
        type: 'updateView',
        line: topLine,
        source: resource.toString(),
      });
    }
  }

  private postMessage(msg: any)
  {
    if (!this._disposed)
    {
      this.editor.webview.postMessage(msg);
    }
  }

  private async doUpdate(): Promise<void>
  {
    const resource = this._resource;

    clearTimeout(this.throttleTimer);
    this.throttleTimer = undefined;

    const document = await vscode.workspace.openTextDocument(resource);
    if (!this.forceUpdate && this.currentVersion
      && this.currentVersion.resource.fsPath === resource.fsPath
      && this.currentVersion.version === document.version)
    {
      if (this.line)
      {
        this.updateForView(resource, this.line);
      }
      return;
    }
    this.forceUpdate = false;

    this.currentVersion = { resource, version: document.version };

    const content = await this._contentProvider.providePreviewHTML(document, this.line, this.state);
    if (this._resource === resource)
    {
      this.editor.title = WebviewPreview.getPreviewTitle(this._resource);
      this.editor.webview.options = WebviewPreview.getWebviewOptions(resource);
      this.editor.webview.html = content;
    }
  }

  private static getWebviewOptions(
    resource: vscode.Uri
  ): vscode.WebviewOptions
  {
    return {
      enableScripts: true,
      enableCommandUris: true,
    };
  }


  private onDidScrollPreview(line: number)
  {
    this.line = line;
    for (const editor of vscode.window.visibleTextEditors)
    {
      if (!this.isPreviewOf(editor.document.uri))
      {
        continue;
      }

      this.isScrolling = true;
      const sourceLine = Math.floor(line);
      const fraction = line - sourceLine;
      const text = editor.document.lineAt(sourceLine).text;
      const start = Math.floor(fraction * text.length);
      editor.revealRange(
        new vscode.Range(sourceLine, start, sourceLine + 1, 0),
        vscode.TextEditorRevealType.AtTop);
    }
  }

  private async onDidClickPreview(line: number): Promise<void>
  {
    for (const visibleEditor of vscode.window.visibleTextEditors)
    {
      if (this.isPreviewOf(visibleEditor.document.uri))
      {
        const editor = await vscode.window.showTextDocument(visibleEditor.document, visibleEditor.viewColumn);
        const position = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(position, position);
        return;
      }
    }

    vscode.workspace.openTextDocument(this._resource).then(vscode.window.showTextDocument);
  }

  private async onDidClickPreviewLink(path: string, fragment: string | undefined)
  {
    /* Do something on link click */
  }

  private async onCacheImageSizes(imageInfo: { id: string, width: number, height: number }[])
  {
    this.imageInfo = imageInfo;
  }
}

export interface PreviewSettings
{
  readonly resourceColumn: vscode.ViewColumn;
  readonly previewColumn: vscode.ViewColumn;
}
