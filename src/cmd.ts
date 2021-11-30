import * as vscode from 'vscode';
var spawn = require('child_process').spawn;
var iconv = require('iconv-lite');
var free:any = undefined;

export namespace ccmd {
    export function stop_shell(): void {
        if (free !== undefined) {
            free.kill();
        }
        free = undefined;
    }

    export function run_shell( args:Array<string>, stdoutCb:any = null, stderrCb:any = null, exitCb:any = null ):any {
        stop_shell();

        free = spawn(args[0], args.slice(1));

        // 捕获标准输出并将其打印到控制台 
        free.stdout.on('data', function (data: string) { 

            // console.log('standard output:\n' + iconv.decode(data, "GBK")); 
            if (stdoutCb !== null) {
                stdoutCb(iconv.decode(data, "GBK"));
            }
            

        });

        // 捕获标准错误输出并将其打印到控制台 

        free.stderr.on('data', function (data: string) { 

            // console.log('standard error output:\n' + iconv.decode(data, "GBK")); 
            if (stderrCb !== null) {
                stderrCb(iconv.decode(data, "GBK"));
            }
        });

        // 注册子进程关闭事件 
        free.on('exit', function (code: number, signal: any) { 

            console.log('child process eixt ,exit:' + code); 
            
            // 这里不打印执行结果，因为有些步骤是多条命令执行的
            // if (code === 0) {
            //     vscode.window.showInformationMessage('执行完成!'); 
            // } else {
            //     vscode.window.showErrorMessage('执行失败, 错误码: ' + code); 
            // }
            // vscode.window.showInformationMessage('cmd run finish, exit:' + code);
            if (exitCb !== null) {
                exitCb(code);
            }

        });

    }

    export function init(context: vscode.ExtensionContext) {
        console.log('cmd is now active!');
        let cmd = vscode.commands.registerCommand('PuduIde.cmd', () => {
            ccmd.run_shell('ping www.baidu.com'.split(" "));
        });
    
        context.subscriptions.push(cmd);
    }
}

// module.exports = ccmd;
