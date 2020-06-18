/*---------------------------------------------------------------------------------------------
  *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { disposeAll } from '../util/dispose';
import { MyDocFileTopmostLineMonitor } from '../util/topmostLineMonitor';
import { WebviewPreview, PreviewSettings } from './WebviewPreviewProvider';
import { WebviewContentProvider } from './WebviewContentProvider';


export class WebviewPreviewManager implements vscode.WebviewPanelSerializer
{
  private static readonly MydocPreviewActiveContextKey = 'MydocPreviewFocus';

  private readonly _topmostLineMonitor = new MyDocFileTopmostLineMonitor();
  private readonly _previews: WebviewPreview[] = [];
  private _activePreview: WebviewPreview | undefined = undefined;
  private readonly _disposables: vscode.Disposable[] = [];

  public constructor(
    private readonly _contentProvider: WebviewContentProvider)
  {
    this._disposables.push(vscode.window.registerWebviewPanelSerializer(WebviewPreview.viewType, this));
  }

  public dispose(): void
  {
    disposeAll(this._disposables);
    disposeAll(this._previews);
  }

  public refresh()
  {
    for (const preview of this._previews)
    {
      preview.refresh();
    }
  }


  public preview(
    resource: vscode.Uri,
    previewSettings: PreviewSettings
  ): void
  {
    let preview = this.getExistingPreview(resource, previewSettings);
    if (preview)
    {
      preview.reveal(previewSettings.previewColumn);
    } else
    {
      preview = this.createNewPreview(resource, previewSettings);
    }

    preview.update(resource);
  }

  public get activePreviewResource()
  {
    return this._activePreview && this._activePreview.resource;
  }

  public async deserializeWebviewPanel(
    webview: vscode.WebviewPanel,
    state: any
  ): Promise<void>
  {
    const preview = await WebviewPreview.revive(
      webview,
      state,
      this._contentProvider,
      this._topmostLineMonitor);

    this.registerPreview(preview);
  }

  private getExistingPreview(
    resource: vscode.Uri,
    previewSettings: PreviewSettings
  ): WebviewPreview | undefined
  {
    return this._previews.find((preview) =>
      preview.matchesResource(previewSettings.previewColumn));
  }

  private createNewPreview(
    resource: vscode.Uri,
    previewSettings: PreviewSettings
  ): WebviewPreview
  {
    const preview = WebviewPreview.create(
      resource,
      previewSettings.previewColumn,
      this._contentProvider,
      this._topmostLineMonitor);

    this.setPreviewActiveContext(true);
    this._activePreview = preview;
    return this.registerPreview(preview);
  }

  private registerPreview(
    preview: WebviewPreview
  ): WebviewPreview
  {
    this._previews.push(preview);

    preview.onDispose(() =>
    {
      const existing = this._previews.indexOf(preview);
      if (existing === -1)
      {
        return;
      }

      this._previews.splice(existing, 1);
      if (this._activePreview === preview)
      {
        this.setPreviewActiveContext(false);
        this._activePreview = undefined;
      }
    });

    preview.onDidChangeViewState(({ webviewPanel }) =>
    {
      disposeAll(this._previews.filter((otherPreview) => preview !== otherPreview && preview!.matches(otherPreview)));
      this.setPreviewActiveContext(webviewPanel.active);
      this._activePreview = webviewPanel.active ? preview : undefined;
    });

    return preview;
  }

  private setPreviewActiveContext(value: boolean)
  {
    vscode.commands.executeCommand('setContext', WebviewPreviewManager.MydocPreviewActiveContextKey, value);
  }
}
