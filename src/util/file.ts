/*---------------------------------------------------------------------------------------------
  *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export function isMyDocFile(document: vscode.TextDocument) {
  return document.languageId === 'mydoc';
}
