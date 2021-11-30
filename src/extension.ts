// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {ccmd} from './cmd';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "PuduIde" is now active!');

	require('./hello.ts')(context);
	// ccmd.init(context);
	require('./webview.ts')(context);
	vscode.commands.executeCommand('PuduIde.burnViewClose');
}

// this method is called when your extension is deactivated
export function deactivate() {
	vscode.commands.executeCommand('PuduIde.burnViewClose');
	console.log('Congratulations, your extension "PuduIde" is now deactive!');
}
