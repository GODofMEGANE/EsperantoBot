const vosk = require("vosk");
const mic = require("mic");
const axios = require("axios");
const OpenAI = require("openai");
const fs = require("fs");
const readline = require("readline");
require('dotenv').config();

const MODEL_PATH = "./model";
vosk.setLogLevel(0);

const MIC_DEVICE = "hw:3,0";

const voskModel = new vosk.Model(MODEL_PATH);
const voskRec = new vosk.Recognizer({model: voskModel, sampleRate: 16000});

let OPENAI_API_KEY;
let AC_IP_ADDRESS;
let AC_PASSWORD;

// 環境変数の読み込み
async function LoadEnv(valuename){
  if(process.env[valuename]){
    return process.env[valuename];
  }
  console.error(`Error: ${valuename} is not set. Please set a new value.`);
  const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: true
	});
  return new Promise((resolve) => {
		rl.question(`Enter ${valuename} : `, (value) => {
      process.env[valuename] = value;
			fs.appendFileSync('.env', `${valuename}=${value}\n`);
			console.log(`Set ${valuename} successfully!`);
			rl.close();
			resolve(value);
		});
	});
}

// Accontrolのコマンドリスト取得
async function GetAccontrolCommands(){
  const res = await fetch(`http://${AC_IP_ADDRESS}/list`, {
    method: "POST"
  });
  return await res.json();
}

// OpenAIに投げる
let openai = null;
async function GetOpenAI(){
  if(openai) return openai;
  const apiKey = OPENAI_API_KEY;
  openai = new OpenAI({
    apiKey: apiKey
  });
  return openai;
}

let functionCalling_accontrol;

async function SendToOpenAI(text){
  const openai = await GetOpenAI();
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages:[
      {role:"system",content:`ユーザーの発話からエアコン操作の命令を判断し、必要ならaccontrolを呼び出す`},
      {role:"user",content:text}
    ],
    tools: functionCalling_accontrol,
  });
  const tool = res.choices[0].message.tool_calls?.[0];

  if(tool && tool.function.name === "accontrol"){
    console.log(tool);
    const args = JSON.parse(tool.function.arguments);
    const res = await fetch(`http://${AC_IP_ADDRESS}:80/control`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        password: AC_PASSWORD,
        command: args.command
      })
    });
    const text = await res.text();
    console.log(text);
  }
}

// マイクの起動
const micInstance = mic({
  rate: "16000",
  channels: "1",
  device: MIC_DEVICE,
  debug: false
});

const micStream = micInstance.getAudioStream();

micStream.on("data", (data) => {
  if(voskRec.acceptWaveform(data)){
    const result = voskRec.finalResult();
    if(result.text){
      console.log("heard:",result.text);
      SendToOpenAI(result.text);
    }
  }
});
micStream.on("error", (err) => {
  console.error("Mic initialize error: ", err);
});
micStream.on("start", (err) => {
  console.log("Mic recording start");
});



async function Start(){
  OPENAI_API_KEY = await LoadEnv("OPENAI_API_KEY");
  AC_IP_ADDRESS = await LoadEnv("AC_IP_ADDRESS");
  AC_PASSWORD = await LoadEnv("AC_PASSWORD");

  console.log("Get command list...");
  const res = await fetch(`http://${AC_IP_ADDRESS}/list`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      password: AC_PASSWORD,
    })
  });
  const data = await res.json();
  const accontrol_commands = data.commands;
  console.log(`Get commands list : ${accontrol_commands}`);

  functionCalling_accontrol = [{
    type: "function",
    function: {
      name: "accontrol",
      description: "control air conditioner",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            enum: accontrol_commands,
          }
        },  
        required:["command"],
      }
    }
  }];

  micInstance.start();
  console.log("Mic initialize...");
}
Start();