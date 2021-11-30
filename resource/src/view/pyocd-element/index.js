const testMode = false; // 为true时可以在浏览器打开不报错
// vscode webview 网页和普通网页的唯一区别：多了一个acquireVsCodeApi方法
const vscode = testMode ? {} : acquireVsCodeApi();
const callbacks = {};
var deviceArry = [];
var readAddrSave = '0x0';

/**
 * 日志添加
 * @param data 字符串
 */
function logAdd(data) {
    vue.$data.textarea += data;
    let count = vue.$data.textarea.split(/\r\n|\r|\n/).length;
    if (count > 200 + 1) {
      while(vue.$data.textarea.split(/\r\n|\r|\n/).length > 150) {
        let index = vue.$data.textarea.indexOf('\n', 0);
        vue.$data.textarea = vue.$data.textarea.substr(index+1);
      }
    }
    let textarea = document.getElementById('textarea_id');
    textarea.scrollTop = textarea.scrollHeight;
}

/**
 * flash数据添加
 * @param data 字符串
 */
 function flashReadAdd(data) {
  vue.$data.flashArea += data;
  let textarea = document.getElementById('readarea_id');
  textarea.scrollTop = textarea.scrollHeight;
}

/**
 * 调用vscode原生api
 * @param data 可以是类似 {cmd: 'xxx', param1: 'xxx'}，也可以直接是 cmd 字符串
 * @param cb 可选的回调函数
 */
 function callVscode(data, cb) {
    if (typeof data === 'string') {
        data = { cmd: data };
    }
    if (cb) {
        // 时间戳加上5位随机数
        const cbid = Date.now() + '' + Math.round(Math.random() * 100000);
        callbacks[cbid] = cb;
        data.cbid = cbid;
    }
    vscode.postMessage(data);
}

window.addEventListener('message', event => {
  const message = event.data;
  // console.log(message.data);
  switch (message.cmd) {
      case 'vscodeCallback':
        (callbacks[message.cbid] || function () { })(message.data);
        delete callbacks[message.cbid];
        break;
      case 'choieBurnFile':
        if (message.data.text[0] === '/') {
          vue.$data.burFile = message.data.text.substr(1);
        } else {
          vue.$data.burFile = message.data.text;
        }
        
        break;
      case 'cmd_stdout':
      case 'cmd_stderr':
        let str1 = message.data.text;
        logAdd(str1);
        break;
      case 'cmd_exit':
        console.log(message.data.code);
        if (message.data.code === 0) {
          vue.$message.success('执行完成');
        } else {
          vue.$message.error('执行失败, 错误码' + message.data.code);
        }
        break;

      case 'read_stdout':
      case 'read_stderr':
        flashReadAdd(message.data.text);
        break;

      case 'deviceList':
        vue.$data.gridData = [];
        deviceArry = message.data.text;
        let filterStr = vue.$data.filterInput;

        for (let i = 0; i < deviceArry.length; i++) {
          if (filterStr === '' || deviceArry[i].indexOf(filterStr) !== -1) {
            vue.$data.gridData.push({deviceName: deviceArry[i]});
          }
        }
        vue.$data.dialogTableVisible = true;
        break;

      // 保存文件反馈
      case 'saveFileRes':

        if (message.data.code === 0) {
          vue.$message.success('保存成功');
        } else {
          vue.$message.success('保存失败');
        }

        break;
      // vscode调用开始烧录方法:
      case 'startBurn':
        console.log(message.data.path);
        if (message.data.path[0] === '/') {
          vue.$data.burFile = message.data.path.substr(1);
        } else {
          vue.$data.burFile = message.data.path;
        }
        
        if (vue.$data.burDevice === '') {
          vue.$message.error('芯片型号不能为空');
          break;
        }

        callVscode({ cmd: 'startBurn', info: {
                          file: vue.$data.burFile,
                          addr: vue.$data.burnAddr,
                          device: vue.$data.burDevice
                        }}, null);
        
        vue.$message('开始烧录');   
        break;
      default: break;
  }
});


var vue = new Vue({
    el: '#app',
    data: function() {
      return { 
        logRows:15,
        burnAddr:"0x08000000",
        textarea:"",
        flashArea:"",
        projectVersion:"加载中",
        burFile:"",         // 烧录文件
        burDevice:"",       // 烧录芯片
        filterInput:"",     // 芯片过滤输入
        readStartAddr:"0x08000000",   // 芯片读取起始地址
        readSize: "0x200",               // 芯片读取大小
        tabActivateName:"logTab",     // tab当前页
        dialogTableVisible: false,
        dialogReadVisible:false,
        gridData: [{
          deviceName: 'stm32'
        }],
      };
    },
    mounted() {
      callVscode('getProVersion', projectVersion => this.projectVersion = projectVersion);
    },
    created() {
      //页面创建时执行一次getHeight进行赋值，顺道绑定resize事件
      window.addEventListener("resize", this.getHeight);
      this.getHeight();
    },
    methods:{
      // 日志清空
      logClear() {
        this.textarea = '';
        callVscode({ cmd: 'test', info: "null" }, null);
      },
      // 选择烧录文件
      choiceBurnFile() {
        callVscode({ cmd: 'choieBurnFile', info: "null" }, null);
      },

      // 选择烧录芯片
      choiceBurnDevice() {
        callVscode({ cmd: 'choieBurnDevice', info: "null" }, null);
      },

      // 筛选
      filtChange() {
        if (this.filterInput === '') {
          for (let i = 0; i < deviceArry.length; i++) {
            vue.$data.gridData.push({deviceName: deviceArry[i]});
          }
        } 

        let filterStr = this.filterInput;
        vue.$data.gridData = [];
        for (let i = 0; i < deviceArry.length; i++) {
          if (deviceArry[i].indexOf(filterStr) !== -1) {
            vue.$data.gridData.push({deviceName: deviceArry[i]});
          }
        }
      },

      // 开始烧录
      startBurn() {
        // 合法性校验
        if (this.burFile === ''){
          this.$message.error('烧录文件不能为空');
          return;
        }
        
        if (this.burDevice === '') {
          this.$message.error('芯片型号不能为空');
          return;
        }

        callVscode({ cmd: 'startBurn', info: {
                          file: this.burFile,
                          addr: this.burnAddr,
                          device: this.burDevice
                        }}, null);
        
        this.$message('开始烧录');          
      },

      // 芯片双击事件
      tableDbDevice(row, column, cell, event) {
        // console.log(row, column, cell, event);
        // console.log(row.deviceName);
        this.dialogTableVisible = false;
        this.burDevice = row.deviceName;
      },

      // 读取flash
      flashRead() {
        if (this.burDevice === '') {
          this.$message.error('芯片型号不能为空');
          return;
        }
        this.dialogReadVisible = true;
      },

      // 开始读取
      startRead() {
        if (this.readStartAddr === '') {
          this.$message.error('起始地址不能为空');
          return;
        }

        if (this.readSize === '') {
          this.$message.error('读取大小不能为空');
          return;
        }

        readAddrSave = this.readStartAddr;
        callVscode({ cmd: 'startRead', info: {
          size: this.readSize,
          addr: this.readStartAddr,
          device: this.burDevice
        }}, null);

        this.flashArea = '';
        this.dialogReadVisible = false;
        this.tabActivateName = "readTab";
        this.$message('开始读取, 请等待弹窗执行完成!!!'); 
      },

      // flash读取另存为
      saveRead() {
        if (this.flashArea === '') {
          this.$message.error('flash读取日志为空，不支持保存');
          return;
        }
        
        callVscode({ cmd: 'chioceSaveFile', info: {
          text: this.flashArea,
          start: readAddrSave
        }}, null);
        this.$message('请选择保存的文件'); 
      }, 
      //定义方法，获取高度减去头尾
      getHeight() {
        // head + foot = 60  烧录选项150 
        logPx = window.innerHeight - 60 - 130;
        this.logRows = logPx / 30;
        // console.log(this.logRows);
        return this.logRows;
      }
    }
})