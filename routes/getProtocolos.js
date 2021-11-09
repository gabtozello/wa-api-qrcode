const express = require('express');
const router = express.Router();
const ejs = require("ejs");
const pdf = require("html-pdf");
const fs = require('fs');
const path = require('path');
const { Client } = require('whatsapp-web.js');
const client = new Client({ puppeteer: { headless: false } });
client.initialize();




app = express();



router.get('/', async function (req, res) {
    console.log('get ok!')
    


        //Cria pasta p/ salvar histórico de PRINTS
        const dataHora = await criaPasta();
        
        //Inicia Puppeteer
        const browser = client.pupBrowser
      //  console.log(client)
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 800});
        //Faz Login e abre pagina inicial
        await login(page);

        //Filtro de Fila
        console.log('carregando filtros...')

        //Rotina de limpeza de filtros
        await limpaFiltros(page);
      
        //Filtro de Duvidas
        filtro = filtroDuvidas;
        await carregaFiltro(filtro,page)
        //Caputa o numero de protocolos em aberto na caixa de cada operador.
        await getProtocolos(listaOperadores,filtro,filtroDuvidas,page,dataHora);
      
        //Repeat
        console.log('Iniciando segunda Rotina')
        console.log('Abrindo HomePage...')
        await page.goto(linkHomePage, {waitUntil: 'load', timeout: 0});

        //Filtro de Fila
        console.log('carregando filtros...')
      
        await limpaFiltros(page);
        
      
        
        //Filtro de autuação
        filtro = filtroAutuacao ;
        await carregaFiltro(filtro,page)
        await getProtocolos(listaOperadores,filtro,filtroDuvidas,page,dataHora);
      
       
      
      
        //CRIA RELATORIO EM PDF
        await gerarPDF(listaOperadores,dataHora);

        let pdfPath = "/report " + dataHora + ".pdf"
        console.log('path '+ pdfPath)

        //Fecha Browser
        console.log('fechando Browser')
        res.send(pdfPath);

});



//FUNÇÔES
async function login(page){

    //login
    console.log('fazendo Login...')
  
    await page.goto('https://sigrc.prefeitura.sp.gov.br/auth-web/', {waitUntil: 'load', timeout: 0});
    await page.type('#username','D858911')
    await page.type('#password','Mieges876422')
    await page.click('button[type="submit"]')  
    
    //erro 403
    console.log('pulando erro 403')
    const verify403 = await page.waitForSelector('input[type="submit"]'); 
  
    if (verify403) {
    await page.click('input[type="submit"]') 
  }
    //Home Page
    console.log('Login ok!')
    console.log('Abrindo HomePage...')
  
    await page.goto(linkHomePage, {waitUntil: 'load', timeout: 0});
  }
  
  async function criaPasta(){
    var dateTime = require('node-datetime');
    var dt = dateTime.create();
    var dataHora = dt.format('d-m-Y H M S');
    nomePasta = dataHora.toString()
    console.log(nomePasta);
    
    fs.mkdir(path.join('./prints/', nomePasta), (err) => {
      if (err) {
          return console.error(err);
      }
      console.log('Directory created successfully!');
    });
    return dataHora
  }
  
  async function limpaFiltros(page){
  
    var verifyPage = page.url();
    if (verifyPage != linkHomePage) {
      await login(page);
    }
    try {
      await page.waitForSelector('#btnFiltroOrgao'); 
    await page.click('#btnFiltroOrgao')
    await page.click('#btnFiltroOrgao') //NÃO QUESTIONAR rs
    await page.waitForSelector('.empty'); 
    await page.click('.remove-all') 
    } catch (error) {
      await page.waitForSelector('#btnFiltroOrgao'); 
    await page.click('#btnFiltroOrgao')
    await page.click('#btnFiltroOrgao') //NÃO QUESTIONAR rs
    await page.waitForSelector('.empty'); 
    await page.click('.remove-all') 
    }
  
  
    
  }
  
  async function carregaFiltro(filtro, page){
    var arrayLength = filtro.length; 
    for (var i = 0; i < arrayLength; i++) {
        console.log('filtro selecionado: '+filtro[i]);''
        await page.type('.empty',filtro[i])// <-- Seleciona Fila
        await page.click('.add-all')
        await page.evaluate( () => document.querySelector('.empty').value = "")
  
    }
    console.log('Rotina de Filtro ok!');
      await page.click('#btn-imprimir')  
    
      //Loop p/ Operador
    await page.waitForNavigation()
  }
  
  async function getProtocolos(listaOperadores,filtro,checkfiltro,page,dataHora) { 
    console.log('Iniciando loop de operadores')
  for(const [key, value] of Object.entries(listaOperadores)){
          //const page = await browser.newPage();
          await page.goto(linkCaixaOperadores+value.codigo, {waitUntil: 'load', timeout: 0});
          await page.setViewport({ width: 1366, height: 800 });
          await page.screenshot({path: './prints/'+dataHora+'/'+value.nome+' - autuação.jpeg',
                                 type: "jpeg",
                                 fullPage: true
                                });
  
  
  if (filtro === checkfiltro) {
    listaOperadores[key].duvidas =  await page.evaluate( () => document.querySelector('.blue-counter').innerText)  
    console.log(listaOperadores[key].duvidas +' AQUI DANILO...');  
    console.log(value.nome, value.codigo +' ok...'); 
  }else{
  
    listaOperadores[key].autuacao =  await page.evaluate( () => document.querySelector('.blue-counter').innerText)
    listaOperadores[key].total = parseInt(listaOperadores[key].autuacao) + parseInt( listaOperadores[key].duvidas);
  
  
      console.log(value.nome, value.codigo +' ok...'); 
    }
  
  }
  }
  
  async function gerarPDF(listaOperadores,dataHora){
   ejs.renderFile(path.join('./views/', "template.ejs"), { listaOperadores: listaOperadores }, (err, data) => {
      if (err) {
        console.log(err);
        return err;
      } else {
        pdf.create(data).toFile("report " + dataHora + ".pdf", function (err, data) {
          if (err) {
            console.log(err);
            return err;
          } else {
            console.log("File created successfully");
            console.log(data.filename);
          }

        });
      }

    });
   
    }
  
  
  
  
  
  //VARIAVEIS GLOBAIS
  let listaOperadores =
    fs.readFile('./util/operadores.json', 'utf8', (err, data) => {
    if (err) throw err;
    listaOperadores = JSON.parse(data);
    console.log('carregando lista de operadores...')
    //console.log(listaOperadores)
  
    return listaOperadores;
  });
  
  var filtroAutuacao = ['SF-Autuação de Processos'];
  var filtroDuvidas = [
    'SF-AGENDAMENTO',  
    'SF-AUTO DE INFRAÇÃO',
    'SF-CADIN',
    'SF-CCM',
    'SF-CERTIDÕES',
    'SF-CPOM',
    'SF-Declarações',
    'SF-Devoluções e Restituições',
    'SF-DIADI',
    'SF-DUC',
    'SF-Habite-se',
    'SF-Imunidades',
    'SF-IPTU',
    'SF-ISS',
    'SF-ITBI',
    'SF-Juntada',
    'SF-MULTAS',
    'SF-NFS-e',
    'SF-PARCELAMENTO',
    'SF-Processo Administrativo',
    'SF-Regimes Especiais',
    'SF-SAC',
    'SF-SENHA WEB',
    'SF-TAXAS MOBILIÁRIAS',
    'SF-VISTA DE PROCESSOS'
    ]
  var filtro= []
  
  var linkCaixaOperadores = 'https://sigrc.prefeitura.sp.gov.br/resolucao-web/solicitacoes/atribuidas?pageSize=10&idUsuarioSolicitacao='
  var linkHomePage = 'https://sigrc.prefeitura.sp.gov.br/resolucao-web/'
  





module.exports = router;