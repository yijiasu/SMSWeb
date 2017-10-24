// read all msg = AT+CMGL=4

const _ = require('lodash')
const net = require('net')

const readline = require('readline');
const pdu = require('pdu');
const fs = require('fs');

const RECV_FILE_PATH = '../public/recv_sms.json'
const CONFIG_FILE_PATH = '../public/config.json'

const SER2NET_PORT = 2000
const SER2NET_ADDR = os.hostname() == 'raspberrypi' ? '127.0.0.1' : '192.168.50.50'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const INIT_CONFIG = {
  auto_increment_id: 0,
  last_msg_recv_time: null,
  phone_number: ''
}


var SMSUtil = {

  isConnected: false,
  hasBootstrap: false,
  isBusy: false,
  lastCommand: "",
  buffer: "",
  default_client: null,
  config: null,

  verboseLog(string) {
    // console.log(string)
    console.log(`[VERBOSE] === ${JSON.stringify(string)}`)
  },

  getPhoneNum(client){
    
  },

  bootstrap(client) {
    if (this.config == null || this.config == undefined) {
      console.log("unable to bootstrap! config is undefined")
      process.exit()
      
    }
    client.write("AT\n")
    this.default_client = client

    _.delay( () => { client.write(`ATE0\n`) }, 100 )    
    _.delay( () => { client.write(`AT+CPMS="ME","ME","ME"\n`) }, 200 )
    _.delay( () => { this.hasBootstrap = true; console.log("Bootstrap Success!") }, 500 )
    _.delay( () => { this.sendCmd(client, `AT+CNUM`) }, 800 )    
    
  },

  sendCmd(client, cmd){
    
    // if (!this.isConnected) { console.log("[ERROR] Device is disconnected"); return; }
    if (this.isBusy) { console.log("[WARN] Device is BUSY. Unable to send command."); return; }
    if (!_.startsWith(cmd, "AT")) { console.log("[ERROR] MUST START WITH AT."); return; }
    client.write(cmd + "\n")
    this.isBusy = true
    this.buffer = ""
    this.lastCommand = cmd
  },

  handleData(client, data) {
    if (!this.hasBootstrap) return;

    if (this.isBusy)
    {
      // BUSY status: waiting for response
      this.buffer += data
      this.checkCompleteResponse() 
    }
    else
    {
      // Not BUSY: Event
      if (_.startsWith(data, "\r\n+")) {
        // Event
        var event_msg = _.replace(data, "\r\n", '')
        this.handleEvent(client, event_msg)
      }
    }
  },

  handleEvent(client, event_msg) {
    console.log("====== HANDLE EVENT ======")
    this.verboseLog(event_msg)
    console.log("====== HANDLE EVENT ======\n\n")    
    
    if (_.startsWith(event_msg, "+CMTI"))
    {
      console.log("NEW MESSAGE!")
      // Wait 3 second and read all SMS
      _.delay(() => {
        this.sendCmd(client, "AT+CMGL=4")
      }, 3000)
    }
    
  },

  handleResponse(response) {
    console.log("====== HANDLE RESPONSE ======")
    this.verboseLog(response)
    console.log("====== HANDLE RESPONSE ======\n\n")    

    if (_.startsWith(response, "+CMGL"))
    {
      console.log("READING ALL MSG")
      var all_msg = _.split(response, "\r\n\r\n")

      var parsing_msg = []
      _.each(all_msg, function(msg){
        const msg_pdu_data = _.split(msg, "\r\n")[1]
        parsing_msg.push(pdu.parse(msg_pdu_data))
      })

      this.parseBatchMsg(parsing_msg)
      _.delay(function(){ SMSUtil.sendCmd(SMSUtil.default_client, "AT+CMGD=90,4")}, 1000)
    }
    else if (_.startsWith(response, "+CNUM"))
    {
      phone_num = _.trim(_.split(response, ",")[1], '\"')
      this.config.phone_number = phone_num
      this.syncConfigToFile()
    }
  },

  parseBatchMsg(all_msg)
  {
    all_msg = _.map(all_msg, this.removeMsgPadding)

    var all_long_msg = _.filter(all_msg, 'udh')
    var all_short_msg = _.difference(all_msg, all_long_msg)
    var all_parsed_msg = []

    if (all_long_msg.length != 0)
    {
      all_long_msg = _.sortBy(all_long_msg, (msg) => { return _.last(msg.udh) })
      single_long_msg = _.reduce(all_long_msg, (result, new_msg) => { 
        result.text += new_msg.text
        return result
      })
  
      delete single_long_msg.udh

      all_parsed_msg = _.union(all_short_msg, [single_long_msg])
      
    }
    else
    {
      all_parsed_msg = all_short_msg
    }

    all_parsed_msg = _.sortBy(all_parsed_msg, 'time')
    _.each(all_parsed_msg, function(msg){
      msg['msg_id'] = SMSUtil.indexForNewMessage()
    })

    console.log("ALL MSG")
    console.log("%j", all_parsed_msg)

    this.appendMsgToFile(all_parsed_msg)
    
    
  },
  
  appendMsgToFile(msg)
  {
    if (!fs.existsSync(RECV_FILE_PATH))
    {
      fs.writeFileSync(RECV_FILE_PATH, '[]')
    }

    var all_msg_data = JSON.parse(fs.readFileSync(RECV_FILE_PATH, 'utf8'))
    all_msg_data = _.union(all_msg_data, msg)
    fs.writeFileSync(RECV_FILE_PATH, JSON.stringify(all_msg_data))

    console.log("Write New Msg to File Success")
  },

  indexForNewMessage()
  {
    this.config.auto_increment_id++
    this.syncConfigToFile()

    return this.config.auto_increment_id

  },

  removeMsgPadding(msg)
  {
    msg.text = _.trim(msg.text, '\u0000')
    return msg
  },

  checkCompleteResponse() {
    if(
      _.endsWith(this.buffer, "\r\nERROR\r\n") || 
      _.endsWith(this.buffer, "\r\nOK\r\n")
    )
    {
      var response = this.buffer;
      this.isBusy = false
      this.buffer = ""

      //1. remove tail
      response = _.replace(response, "\r\nOK\r\n", '')
      response = _.replace(response, "\r\nERROR\r\n", '')      
      
      //2. remove head
      response = _.replace(response, `${this.lastCommand}\r\n`, '')

      response = _.trim(response, "\r\n")
      this.handleResponse(response)      
      
    }
  },

  syncConfigToFile() {
    fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(this.config), function(){
      console.log("sync config ok")
    })
  }
}


function main()
{
  fs.readFile(CONFIG_FILE_PATH, (err, data) => {
    var config = {}
    if(err && err.code == 'ENOENT')
    {
      config = INIT_CONFIG
    }
    else
    {
      config = JSON.parse(data)
    }

    console.log("load config success")
    console.log(config)

    SMSUtil.config = config

    var client = new net.Socket()
    client.connect(SER2NET_PORT, SER2NET_ADDR, () =>{
      console.log('Connected to ser2net');
      _.delay(function() {
        SMSUtil.bootstrap(client)
      }, 1000);
    
    })
    
    client.on('data', function(data) {
      console.log("raw_data: ")
      SMSUtil.verboseLog(data.toString())
    
      SMSUtil.handleData(client, data.toString())
    });
    
    rl.question()
    rl.on('line', (input) => {
      SMSUtil.sendCmd(client, input)
    });
  

  })
}


main()

