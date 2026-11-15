export function stationBoardHtml(stationId = ''): string {
  const selectedStation = /^[a-zA-Z0-9._:-]{1,128}$/.test(stationId) ? stationId : ''
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>7anouti station board</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f6f4;color:#17221c;font:16px system-ui}header{position:sticky;top:0;background:#173d31;color:white;padding:1rem;display:flex;justify-content:space-between;align-items:center}main{max-width:1100px;margin:auto;padding:1rem}.status{font-size:.85rem}.count{margin-left:.5rem;border-radius:999px;background:#f8dfd8;color:#7a261b;padding:.15rem .5rem;font-size:.75rem;font-weight:700}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem}.station{background:white;border:1px solid #d5ddd7;border-radius:14px;padding:1rem}.ticket{border:1px solid #d5ddd7;border-radius:12px;padding:.9rem;margin:.75rem 0}.ticket h3{margin:.25rem 0}.muted{color:#5d6b62;font-size:.88rem}.actions{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.7rem}button{border:0;border-radius:10px;background:#1f7454;color:white;font:inherit;font-weight:650;padding:.75rem 1rem;min-height:48px}button.secondary{background:#e5eee8;color:#173d31}input{width:100%;padding:.85rem;border:1px solid #9aaca0;border-radius:8px;font:inherit;margin:.35rem 0 1rem}form{max-width:420px;margin:12vh auto;background:white;padding:1.5rem;border-radius:16px}#message{min-height:1.4rem;color:#a33}@media(max-width:600px){main{padding:.65rem}.grid{grid-template-columns:1fr}header{padding:.75rem}}
</style><header><strong>7anouti · ${selectedStation ? 'Station board' : 'Kitchen / bar boards'}</strong><span id="connection" class="status">Not connected</span></header><main><div id="message" role="status"></div><div id="app"></div></main><script>
const selectedStation=${JSON.stringify(selectedStation)};
const app=document.getElementById('app');
const message=document.getElementById('message');
const connection=document.getElementById('connection');
let socket;
let session;
function readSession(){try{return JSON.parse(sessionStorage.getItem('7anouti-hub-station')||'null')}catch{return null}}
function escapeText(value){return String(value??'')}
function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=escapeText(text);if(className)node.className=className;return node}
function setMessage(text){message.textContent=text||''}
function showPairForm(){
 app.replaceChildren();
 const form=element('form');
 const title=element('h1','Pair this screen');
 const storeLabel=element('label','Store code');storeLabel.htmlFor='store-code';
 const storeCode=element('input');storeCode.id='store-code';storeCode.required=true;storeCode.autocomplete='organization';
 const codeLabel=element('label','Six-digit station device code');codeLabel.htmlFor='pair-code';
 const pairCode=element('input');pairCode.id='pair-code';pairCode.required=true;pairCode.inputMode='numeric';pairCode.pattern='[0-9]{6}';pairCode.maxLength=6;pairCode.autocomplete='one-time-code';
 const button=element('button','Pair screen');
 form.append(title,storeLabel,storeCode,codeLabel,pairCode,button);app.append(form);
 form.addEventListener('submit',async event=>{
  event.preventDefault();button.disabled=true;setMessage('');
  try{const response=await fetch('/api/station/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({storeCode:storeCode.value.trim(),pairingCode:pairCode.value.trim()})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Pairing failed.');session={token:result.token,deviceId:result.deviceId};sessionStorage.setItem('7anouti-hub-station',JSON.stringify(session));connect()}
  catch(error){setMessage(error.message||'Could not pair this screen.');button.disabled=false}
 });
}
function connect(){
 session=readSession();if(!session){showPairForm();return}
 connection.textContent='Connecting…';
 const scheme=location.protocol==='https:'?'wss:':'ws:';
 socket=new WebSocket(scheme+'//'+location.host+'/ws');
 socket.addEventListener('open',()=>socket.send(JSON.stringify({type:'auth',token:session.token,deviceId:session.deviceId})));
 socket.addEventListener('message',event=>{
  let value;try{value=JSON.parse(event.data)}catch{return}
  if(value.type==='connected'){connection.textContent='Live';setMessage('');refresh()}
  else if(value.type==='station-status'||value.type==='sync')refresh()
  else if(value.type==='error'){connection.textContent='Disconnected';setMessage(value.error||'Station session failed.');sessionStorage.removeItem('7anouti-hub-station');session=null;socket.close();showPairForm()}
 });
 socket.addEventListener('close',()=>{connection.textContent='Reconnecting…';setTimeout(connect,2000)});
 socket.addEventListener('error',()=>{connection.textContent='Reconnecting…';socket.close()});
}
async function refresh(){
 try{
  const response=await fetch('/api/stations',{headers:{Authorization:'Bearer '+session.token,'X-Device-Id':session.deviceId}});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Station session expired.');
  render(data);setMessage('');
 }catch(error){setMessage(error.message||'Could not load station tickets.');sessionStorage.removeItem('7anouti-hub-station');session=null;if(socket)socket.close();showPairForm()}
}
function render(data){
 app.replaceChildren();
 const stations=selectedStation?data.stations.filter(item=>item.id===selectedStation):data.stations;
 if(!stations.length){app.append(element('p','This device is not paired to the selected active station.'));return}
 const grid=element('div',undefined,'grid');
 const oldCount=document.querySelector('.count');if(oldCount)oldCount.remove();
 if(data.eightySixCount!==undefined){const count=element('span',data.eightySixCount+' unavailable','count');document.querySelector('header').append(count)}
 for(const station of stations){
  const section=element('section',undefined,'station');section.append(element('h2',station.name));
  const orders=data.orders.filter(order=>order.items.some(item=>item.stationId===station.id));
  if(!orders.length)section.append(element('p','No active tickets.','muted'));
  for(const order of orders)for(const item of order.items.filter(row=>row.stationId===station.id)){
   const card=element('article',undefined,'ticket');
   card.append(element('h3',(item.qty?item.qty+' × ':'')+item.name));
   card.append(element('div','Order #'+order.number+' · '+order.tableName+' · '+(item.boardStatus||item.status),'muted'));
   if(item.note)card.append(element('p','Note: '+item.note,'muted'));
   const actions=element('div',undefined,'actions');
   const status=item.boardStatus||item.status;
   const choices=status==='sent'?[['preparing','Start'],['bumped','Bump']]:status==='preparing'?[['ready','Ready'],['bumped','Bump']]:status==='ready'?[['served','Served'],['bumped','Bump']]:status==='bumped'?[['recalled','Recall']]:[];
   for(const choice of choices){
    const button=element('button',choice[1],choice[0]==='bumped'?'secondary':'');
    button.addEventListener('click',()=>update(order.id,item.id,station.id,choice[0],button));actions.append(button);
   }
   if(actions.childElementCount)card.append(actions);
   section.append(card);
  }
  grid.append(section);
 }
 app.append(grid);
}
async function update(orderId,itemId,id,status,button){
 button.disabled=true;setMessage('');
 try{const response=await fetch('/api/station/status',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.token,'X-Device-Id':session.deviceId},body:JSON.stringify({orderId,itemId,stationId:id,status})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not update ticket.');}
 catch(error){setMessage(error.message||'Could not update ticket.');button.disabled=false}
}
connect();
</script></html>`
}
