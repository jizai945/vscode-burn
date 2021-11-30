import * as vscode from 'vscode';
import * as os from 'os';

module.exports = function(context: vscode.ExtensionContext) {
    console.log('hello is now active!');
    let usr = os.userInfo().username;
    let hello = vscode.commands.registerCommand('PuduIde.hello', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('puduHello '+usr);
		// cmd.run_shell('ping', ['www.baidu.com']);
	});

    context.subscriptions.push(hello);
};