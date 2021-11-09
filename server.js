const express = require('express');
const app = express();
const ejs = require('ejs');
const ExcelJS = require('exceljs');
const path = require('path');
const qrcode = require('qrcode');
const port =  process.env.PORT || 8000;


const fs = require('fs');
const axios = require('axios').default;
const moment = require('moment');

//Variaveis
const botPort = 3000;
const botName = 'teste'
let logger = require('logger').createLogger('development.log'); // logs to a file
logger.setLevel('debug');
//var botAPI = 'http://localhost:'+botPort+'/api/v1/bots/'+botName+'/converse/'
var qrcode_code = '';

const { Client } = require('whatsapp-web.js');
const SESSION_FILE_PATH = './session.json';
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}

const client = new Client({ puppeteer: { headless: false }, session: sessionCfg });


client.initialize();

client.on('qr', (qr) => {
    // NOTE: This event will not be fired if a session is specified.
    console.log('QR RECEIVED', qr);
    qrcode_code = qr;
});

client.on('authenticated', (session) => {
    console.log('AUTHENTICATED', session);
    sessionCfg=session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
        if (err) {
            console.error(err);
        }
    });
});

client.on('auth_failure', msg => {
    // Fired if session restore was unsuccessfull
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('ready', () => {
    console.log('READY');
});

client.on('change_battery', (batteryInfo) => {
  // Battery percentage for attached device has changed
  const { battery, plugged } = batteryInfo;
  console.log(`Battery: ${battery}% - Charging? ${plugged}`);
});

client.on('change_state', state => {
  console.log('CHANGE STATE', state );
});

client.on('disconnected', (reason) => {
  console.log('Client was logged out', reason);
});

//externo
client.on('message', async msg => {
    console.log('MESSAGE RECEIVED');
    //console.log(msg);

    // Envia status da bateria
    if (msg.body === '!bateria') {
      let batteryInfo = await client.info.getBatteryStatus();
      const { battery, plugged } = batteryInfo;
      console.log(`Battery: ${battery}% - Charging? ${plugged}`);
      msg.reply(`Battery: ${battery}% - Charging? ${plugged}`);

    
    } 
    // Envia arquivo Excel
    else if (msg.body.startsWith('/log')) {
      
     await sendLog(msg);
        
  
  } 
  
  
  //ENVIA PERGUNTA AO CHATBOT VIA API
  else if (msg.body.startsWith('/p ') && !msg.broadcast) {
       try {
        let requestLink = botAPI+ msg.from;
        await sendoToBot(msg, requestLink);
       } catch (error) {
         console.log(error);
       }
        
      }
    

//FUNÇÃO DE ENCAMINHAR RESPOSTAS
else if (msg.body.startsWith('/r ') && !msg.broadcast ) {


  if (msg.hasQuotedMsg === true ){

    const quotedMsgs = await msg.getQuotedMessage().then(async resp => { 
      console.log('resp+ '+JSON.stringify(resp))
      console.log('msg'+JSON.stringify(msg))
      try {
        client.sendMessage(resp.author,resp.body)
        await msg.forward(resp.author)
        await gravaExcel(msg,resp);
      } catch ( error) {
        console.log('tentando encaminhar msg: '+ error )
      }
        
    });
  }else{
    msg.reply('Ops, vc esqueceu de marcar a pergunta.');
    console.log('noQuote');
  
  }
  
  }




});



//interno
client.on('message_create', async msg => {
  
  // AQUI DANILO
    if (msg.fromMe && msg.body === "/log") {
      console.log(msg)
      try {
      const { MessageMedia } = require('whatsapp-web.js');
      const media = MessageMedia.fromFilePath('./chats/log.xlsx');
      const chat = await msg.getChat();
      chat.sendMessage(media);
        console.log('log enviado');
      } catch (error) {
        console.log('Err: '+error)
      }
      

    } 
});




// const protocoloRoute = require('./routes/getProtocolos.js');
// app.use('/get',protocoloRoute);

async function gravaExcel(msg,resp){
  const pathExcel = './chats/log.xlsx';
  const workbook = new ExcelJS.Workbook();
  const today = moment().format('DD-MM-YYYY hh:mm')

  if (fs.existsSync(pathExcel)) {
      /**
       * Si existe el archivo de conversacion lo actualizamos
       */
      const workbook = new ExcelJS.Workbook();
      workbook.xlsx.readFile(pathExcel)
          .then(() => {
              const worksheet = workbook.getWorksheet(1);
              const lastRow = worksheet.lastRow;
              var getRowInsert = worksheet.getRow(++(lastRow.number));
              
              getRowInsert.getCell('A').value = resp.body.slice(3);
              getRowInsert.getCell('B').value = msg.body.slice(3);
              getRowInsert.getCell('C').value = resp.author;
              getRowInsert.getCell('D').value = today;
             


              getRowInsert.commit();
              workbook.xlsx.writeFile(pathExcel);
          });
          console.log("LOG ATUALIZADO");

  } else {
      /**
       * NO existe el archivo de conversacion lo creamos
       */
      const worksheet = workbook.addWorksheet('Chats');
      worksheet.columns = [
          { header: 'pergunta', key: 'pergnt' },
          { header: 'resposta', key: 'resp' },
          { header: 'numero', key: 'num' },
          { header: 'horario', key: 'horario' }
      ];
      worksheet.addRow([resp.body,msg.body.slice(3),resp.author,today]);
      workbook.xlsx.writeFile(pathExcel)
          .then(() => {

              console.log("LOG CRIADO COM SUCESSO");
          })
          .catch((err) => {
              console.log("err", err);
          });
  }
}

async function sendoToBot(msg,requestLink){
  let respostaBot = ''
  const mensagem = msg.body.slice(3)
  if(msg.isForwarded === false){

    try {
    const headers = {'Content-Type': 'application/json'}
    const requestBody = {
      "type": "text",
      "text": mensagem
    }
    console.log('axios body = '+requestBody+'axios user = '+msg.from+' HEADERS: '+headers+' link: '+requestLink)
     await axios.post(requestLink,requestBody,headers)
        .then( response => {
          respostaBot = response.data.responses[0].text;
              });
    } catch (error) {
      console.log(error)
    }finally{
      console.log('finally');
      if (respostaBot === undefined || ''){
        msg.reply('deu ruim');
        return
      }else{   
        msg.reply(respostaBot);
        return
      }
    }
    }else{
      console.log('p/ encaminhado - IGNORED')
      return
    }


}

async function sendLog(msg){
  try {
 const { MessageMedia } = require('whatsapp-web.js');
 const media = MessageMedia.fromFilePath('./chats/log.xlsx');
 const chat = await msg.getChat();
 chat.sendMessage(media);
   console.log('log enviado');
 } catch (error) {
   console.log('Err: '+error)
 }
};

// qr code

app.use(express.json())
app.use(express.urlencoded({extended : false}))

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'view'))

// transformar em qr code
app.get('/', (req, res, next) => {
  qrcode.toDataURL(qrcode_code, (err, src) => {
    res.render("scan", {
    qr_code : src
    });
})
})


app.listen(port, () => {
  console.log(`app listening at http://localhost:${port}`)
})

