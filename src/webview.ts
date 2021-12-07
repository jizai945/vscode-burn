import { privateEncrypt } from 'crypto';
import * as vscode from 'vscode';
import {ccmd} from './cmd'
const fs = require('fs');
const path = require('path');
const util = require('./util');

var _last_path:string = "/D:/"; // 记录上次打开的文件对话框位置
const BurnUrl = {
	'Burn': 'webView/burnView/index.html',
	'Compiling Cat': 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif',
	'Testing Cat': 'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif'
};
const devicePath = 'resource\\device';
const pyocdRootPath = 'resource\\pyocd';

var context_save:vscode.ExtensionContext;
var global:any = {};

module.exports = function(context: vscode.ExtensionContext) {
    console.log('webview is now active!');
    context_save = context;

	if (vscode.window.registerWebviewPanelSerializer) {
		// Make sure we register a serializer in activation event
		vscode.window.registerWebviewPanelSerializer(BurnWebView.viewType, {
			async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
				console.log(`Got state: ${state}`);
				// Reset the webview options so we use latest uri for `localResourceRoots`.
				webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
				BurnWebView.revive(webviewPanel, context.extensionUri);
				if (BurnWebView.currentPanel) {
					console.log('close webview');
					BurnWebView.currentPanel.dispose();
				}
			}
		});
	}

	context.subscriptions.push(
		vscode.commands.registerCommand('PuduIde.burnViewOpen', (uri) => {
			BurnWebView.createOrShow(context.extensionUri);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('PuduIde.burnViewRestart', () => {
			if (BurnWebView.currentPanel) {
				BurnWebView.currentPanel.dispose();
			}
			BurnWebView.createOrShow(context.extensionUri);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('PuduIde.burnViewClose', () => {
			if (BurnWebView.currentPanel) {
				console.log('close webview');
				BurnWebView.currentPanel.dispose();
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('PuduIde.rightBurn', (uri) => {
			if (!BurnWebView.currentPanel) {
				vscode.commands.executeCommand('PuduIde.burnViewOpen').then((result:any)=>{
					if (BurnWebView.currentPanel) {
						BurnWebView.currentPanel.startBurn(uri.path);
					}
				});
			
			} else {
				BurnWebView.currentPanel.startBurn(uri.path);
			}
			
			
		})
	);
};

function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
	return {
		// Enable javascript in the webview
		enableScripts: true,

		// And restrict the webview to only loading content from our extension's `media` directory.
		localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
	};
}

// 字符串转array
function Str2Bytes(str:string) : Array<number> {
	if(str.length <= 0){
	  return [];
	}
	if(str.length%2 != 0){
	  str = "0" + str;
	}
	var pos = 0;
	var len = str.length;
	len /= 2;
	var hexA = new Array();
	for (var i = 0; i < len; i++) {
		var s = str.substr(pos, 2);
		var v = parseInt(s, 16);
		hexA.push(v);
		pos += 2;
	}
	return hexA;
}


function invokeCallback(panel:any, message:any, resp:any, cmd:any = 'vscodeCallback') {
	console.log('回调消息：', resp);
	// 错误码在400-600之间的，默认弹出错误提示
	if (typeof resp == 'object' && resp.code && resp.code >= 400 && resp.code < 600) {
		util.showError(resp.message || '发生未知错误！');
	}
	panel.webview.postMessage({cmd: cmd, cbid: message.cbid, data: resp});
}

// 把array数据写入bin文件中
function writeBinFile(path:string, array:Buffer):Boolean {

	// 第一个字符串为/ 会有bug   比如  /C:/Users/Wang/Desktop/123.bin
	if (path[0] === '/') {
		path = path.substr(1);
	} 
	fs.writeFile(path, array, function (err:any) {
		if (err) {
			// util.showError(err.message);
			return false;
		}
		// console.log('write ok');
		return true;
	});

	return true;
}

class BurnWebView {

    /**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
    public static currentPanel: BurnWebView | undefined;

    public static readonly viewType = 'BurnWeb';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    // 创建页面或者重新跳转显示出页面
    public static createOrShow(extensionUri: vscode.Uri) {

        const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

        if (BurnWebView.currentPanel) {
            BurnWebView.currentPanel._panel.reveal(column);
			return;
        }

        // Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			BurnWebView.viewType,	// 标识webview面板的类型。
			'Burn Web',				// 标题
			column || vscode.ViewColumn.One,	// 在编辑器中显示webview的位置。如果设置了preserveFocus，则新的webview将不会对焦。
			{
                enableScripts: true, // 启用JS，默认禁用
                retainContextWhenHidden: true, // webview被隐藏时保持状态，避免被重置
            }
			// getWebviewOptions(extensionUri),
		);

        BurnWebView.currentPanel = new BurnWebView(panel, extensionUri);
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		BurnWebView.currentPanel = new BurnWebView(panel, extensionUri);
	}

    // 构造函数
    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
		global.panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
		this._update();

        // Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programmatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				if (this._panel.visible) {
					this._update();
				}
			},
			null,
			this._disposables
		);

        // Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				this._messageHandler(global, message);
			},
			null,
			this._disposables
		);
    }

    public dispose() {
		BurnWebView.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	// 开始烧录
	public startBurn(path:string) {
		invokeCallback(global.panel, 0, {path: path}, "startBurn");
	}

	private _messageHandler(global:any, message:any) {

		switch (message.cmd) {
			// 弹出提示
			case "alert":	
				util.showInfo(message.info);
				return;

			// 显示错误提示
			case "error":
				util.showError(message.info);
				break;

			// 获取工程名
			case "getProjectName":
				console.log(this._extensionUri);
				util.showInfo(message.info);
				invokeCallback(this._panel, message, path.basename(this._extensionUri.path));
				break;

			// 获取版本号
			case "getProVersion":
				{
					// 从 package.json中获取版本号
					fs.readFile(context_save.extensionPath + '\\package.json', (err:any, data:any) => {
						if (err) {
							console.log(err);
							return;
						}
						let person = data.toString();
						person = JSON.parse(person);
						console.log(person.version);
						util.showInfo(message.info);
						invokeCallback(this._panel, message, person.version);
					});
				}
				break;

			// 选择烧录文件
			case "choieBurnFile":
				vscode.window.showOpenDialog(
						{
							// 可选对象
							canSelectFiles:true, // 是否可选文件
							canSelectFolders:false, // 是否可选文件夹
							canSelectMany:false, // 是否可以选择多个
							defaultUri:vscode.Uri.file(_last_path), // 默认打开本地路径
							filters: {
								'bin/hex':['bin', 'hex'],
								'all':['*']
							},
							openLabel:'确认',
							title: '选择烧录文件'
						}
					).then(function(msg:any) {
						if (msg !== undefined) {
							// util.showInfo('打开的文件'+ msg[0].path);
							invokeCallback(global.panel, message, {code: 0, text:  msg[0].path}, message.cmd);
							_last_path = path.dirname(msg[0].path);
						}				
					});
				break;
			// 选择芯片
			case "choieBurnDevice":
				// console.log("call choieBurnDevice");
				util.readFileDevice(context_save.extensionPath +'/' + devicePath, (data:Array<string>)=>{
					invokeCallback(global.panel, message, {code: 0, text: data}, "deviceList");
				});
				

				break;
			// 开始烧录
			case "startBurn":
				{
					let packStr:string = util.machPackFromTarget(context_save.extensionPath +'\\' + pyocdRootPath + '\\packs', 
										message.info.device);

					if (packStr === '') {
						util.showError('未能查找到packs');
						break;
					}

					let argCmd:Array<string> = [];
					let tmpStr:string = message.info.file.substring(message.info.file.length-3);
					if (tmpStr !== 'hex' && tmpStr !== 'elf') {
						argCmd = [context_save.extensionPath +'\\' + pyocdRootPath + '\\pyocd.exe', 
								'flash', '--erase=auto', '--trust-crc', '--target='+message.info.device,
								'--pack='+ packStr, '--base-address='+message.info.addr,  message.info.file, '-v', '-W'];
					} else {
						argCmd = [context_save.extensionPath +'\\' + pyocdRootPath + '\\pyocd.exe', 
							'flash', '--erase=auto', '--trust-crc', '--target='+message.info.device,
							'--pack='+ packStr,  message.info.file, '-v', '-W'];
					}
					
					
					invokeCallback(global.panel, message, {code: 0, text: ">>>"+argCmd.join(" ")+'\n'}, "cmd_stdout");
					ccmd.run_shell(argCmd,
										(data:string) =>{
											console.log("stdout: " + data);
											invokeCallback(global.panel, message, {code: 0, text: data}, "cmd_stdout");
										}, (data:string) => {
											console.log("stderr: " + data);
											invokeCallback(global.panel, message, {code: 0, text: data}, "cmd_stderr");
										}, (code: number) => {
											console.log("exit: "+ code);
											invokeCallback(global.panel, message, {code: code, text: ""}, "cmd_exit");
											if (code === 0) {
												util.showInfo('执行完成');
											} else {
												util.showError('执行错误, 错误码:'+ code);
											}
										});	
				}
				break;
			case "startRead":
				{
					let packStr:string = util.machPackFromTarget(context_save.extensionPath +'\\' + pyocdRootPath + '\\packs', 
										message.info.device);

					if (packStr === '') {
						util.showError('未能查找到packs');
						break;
					}
				
					let argCmd:Array<string> = [];
					argCmd = [context_save.extensionPath +'\\' + pyocdRootPath + '\\pyocd.exe', 'cmd',
								'--halt', '--command', 'read8', message.info.addr, message.info.size, 
								'--target='+message.info.device, '--pack='+packStr, '-W'];
					invokeCallback(global.panel, message, {code: 0, text: ">>>"+argCmd.join(" ") + '\n'}, "cmd_stdout");
					ccmd.run_shell(argCmd,
						(data:string) =>{
							console.log("stdout: " + data);
							invokeCallback(global.panel, message, {code: 0, text: data}, "read_stdout");
						}, (data:string) => {
							console.log("stderr: " + data);
							invokeCallback(global.panel, message, {code: 0, text: data}, "read_stderr");
						}, (code: number) => {
							console.log("exit: "+ code);

							// 让程序继续执行
							let argCmd2:Array<string> = [];
							argCmd2 = [context_save.extensionPath +'\\' + pyocdRootPath + '\\pyocd.exe', 'cmd',
								'--halt', '--command', 'go', '--target='+message.info.device, 
								'--pack='+packStr, '-W'];

								ccmd.run_shell(argCmd2,
									(data:string) =>{
										console.log("stdout: " + data);
										invokeCallback(global.panel, message, {code: 0, text: data}, "cmd_stdout");
									}, (data:string) => {
										console.log("stderr: " + data);
										invokeCallback(global.panel, message, {code: 0, text: data}, "cmd_stderr");
									}, (code: number) => {
										console.log("exit: "+ code);
										invokeCallback(global.panel, message, {code: code, text: ""}, "cmd_exit");
										if (code === 0) {
											util.showInfo('执行完成');
										} else {
											util.showError('执行错误, 错误码:'+ code);
										}
									});
						});
					break;
				}
				case 'chioceSaveFile':
					{
						vscode.window.showSaveDialog(
							{
								defaultUri: vscode.Uri.file(_last_path), // 默认打开路径
								filters:{
									'bin':['bin'],
									'hex':['hex'],
									'all':['*']
								},
								saveLabel:'保存',
								title: '输入保存文件'
							}
						).then(function (msg:any) {
							if (msg === undefined) {
								return;
							}
							
							_last_path = path.dirname(msg.path);
							// message.info.text.trim().split('\n').forEach(function(v:any, i:any) {
							// 	console.log('第'+i+1+'行: ' + v);	  
							// });

							try {
								let hexArry:Array<number> = [];
								message.info.text.trim().split('\n').forEach(function(v:any, i:any) {
									try {
										let tmp:string = v.split(':')[1];
										tmp = tmp.substr(0, tmp.indexOf("    "));
										tmp = tmp.replace(/ /g, '');
										hexArry = hexArry.concat(Str2Bytes(tmp));
									}
									catch(err:any) {
										throw new Error(err);
									}			
									
								});
								let buf:Buffer = Buffer.from(hexArry); // 转成buffer类型
								let tmp_str:string = context_save.extensionPath +'\\tmp.bin';
								if (msg.path.substring(msg.path.length-3) === 'hex') {
									if (writeBinFile(tmp_str, buf) === false) {
										throw new Error('保存文件失败');
									}

									// bin转hex
									try {									
										let argCmd:Array<string> = [];
										let hex_path:string = '';
										if (msg.path[0] === '/') {
											hex_path = msg.path.substr(1);
										} 
										argCmd = [context_save.extensionPath +'\\resource\\bin_tool\\bin_tool.exe', 'bin-to-hex',
											'--bin='+tmp_str, '--hex=' + hex_path, '--start='+message.info.start];
										ccmd.run_shell(argCmd,
											(data:string) =>{
												console.log("stdout: " + data);
												invokeCallback(global.panel, message, {code: 0, text: data}, "cmd_stdout");
											}, (data:string) => {
												console.log("stderr: " + data);
												invokeCallback(global.panel, message, {code: 0, text: data}, "cmd_stderr");
											}, (code: number) => {
												console.log("exit: "+ code);
												if (code === 0) {
													util.showInfo('保存完成');
												} else {
													util.showError('执行错误, 错误码:'+ code);
												}
												invokeCallback(global.panel, message, {code: code, path: msg.path}, "saveFileRes");

												// 删除临时文件
												fs.unlink(tmp_str, (err:any)=> {
													throw new Error(err);
												});

											});
									} catch(err:any) {
										// 删除临时文件
										fs.unlink(tmp_str, (err:any)=> {
											throw new Error(err);
										});
										throw new Error(err);
									}
								} else {
									
									if (writeBinFile(msg.path, buf) !== true) {
										throw new Error('保存文件失败');
									}

									util.showInfo('保存完成');
									invokeCallback(global.panel, message, {code: 0, path: msg.path}, "saveFileRes");
								} 


							} catch(err:any) {
								invokeCallback(global.panel, message, {code: 1, path: msg.path}, "saveFileRes");
								util.showError(err.message);
								return;
							}
							
						});
					}
					break;
			case 'test':
				this._panel.dispose();
				break;
			default:
				util.showError(`未找到名为 ${message.cmd} 回调方法!`);
		}
		
	}

    private _update() {
		const webview = this._panel.webview;

		// Vary the webview's content based on where it is located in the editor.
		switch (this._panel.viewColumn) {
			case vscode.ViewColumn.Two:
				this._updateForBurn(webview, 'Compiling Cat');
				return;

			case vscode.ViewColumn.Three:
				this._updateForBurn(webview, 'Testing Cat');
				return;

			case vscode.ViewColumn.One:
			default:
				this._updateForBurn(webview, 'Burn');
				return;
		}
	}

    private _updateForBurn(webview: vscode.Webview, catName: keyof typeof BurnUrl) {
		this._panel.title = catName;
		this._panel.webview.html = this._getHtmlForWebview(BurnUrl[catName]);
	}

    private _getHtmlForWebview(url: string) {
        const resourcePath = util.getExtensionFileAbsolutePath(context_save, url);
        const dirPath = path.dirname(resourcePath);
        let html = fs.readFileSync(resourcePath, 'utf-8');
        // vscode不支持直接加载本地资源，需要替换成其专有路径格式，这里只是简单的将样式和JS的路径替换
        html = html.replace(/(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g, (m:any, $1:any, $2:any) => {
			return $1 + vscode.Uri.file(path.resolve(dirPath, $2)).with({ scheme: 'vscode-resource' }).toString() + '"';
		});
        // html = html.replace(/(url\(")(.+?)"/g, (m:any, $1:any, $2:any)=> {
        //     return $1 + vscode.Uri.file(path.resolve(dirPath, $2)).with({ scheme: 'vscode-resource' }).toString() + '"';
        // });
        return html;
    }
}