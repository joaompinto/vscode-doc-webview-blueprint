/*---------------------------------------------------------------------------------------------
  *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DocParser } from './docParser'


export class MyDocEngine {
    private parser?: DocParser;

	public constructor(
	) { }


	private async getEngine(resource: vscode.Uri): Promise<DocParser> {
	  if (!this.parser) {
	    this.parser = new DocParser(resource.fsPath);
	  }

	  return this.parser;
	}

	public async render(document: vscode.Uri, text: string): Promise<string> {
	  const engine = await this.getEngine(document);
	  let ascii_doc = engine.parseText(text)
	  return ascii_doc;
	}

}
