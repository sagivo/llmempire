import {readFileSync} from 'fs';
const html=readFileSync('index.html','utf8');
const m=html.match(/\/\*ENGINE-BEGIN\*\/([\s\S]*?)\/\*ENGINE-END\*\//);
if(!m){console.error('engine block not found');process.exit(1);}
const code=m[1].replace(/^\s*"use strict";/,'');
const mod={exports:{}};
new Function('module','exports',code+'\nmodule.exports={defaultConfig,createWorld,runTick,mockPhaseA,mockPhaseB,legalActions,cellsOf,popCap,executeAct,processDawn,checkVictory,injectDrought,injectSilence,injectMute,injectCurfew,injectCacheDrop,takeSnapshot,truncateSentences};')(mod,mod.exports);
const E=mod.exports;

let fails=0;
const check=(name,cond)=>{ if(!cond){fails++;console.error('FAIL:',name);} else console.log('ok:',name); };

// DoD #1: 4-player match on 8x8 with mock policy completes 100 turns
(async()=>{
  const cfg=E.defaultConfig();
  cfg.width=8; cfg.height=8; cfg.playerCount=4; cfg.maxDays=200; cfg.endMode='open';
  const w=E.createWorld(cfg,42);
  check('4 kingdoms spawned',w.kingdoms.length===4);
  check('each starts with 1 cell',w.kingdoms.every(k=>E.cellsOf(w,k.id).length===1));
  const thinkers={phaseA:async(w,k)=>E.mockPhaseA(w,k),phaseB:async(w,k)=>E.mockPhaseB(w,k)};
  const t0=Date.now();
  for(let i=0;i<100;i++) await E.runTick(w,thinkers);
  const ms=Date.now()-t0;
  check('100 turns completed',w.snapshots.length===101);
  console.log('   100 turns in',ms,'ms =',(100000/(ms||1)).toFixed(0),'turns/sec');
  const acts=w.events.filter(e=>e.type==='Act').map(e=>e.act);
  check('harvests occurred',acts.includes('harvest'));
  check('claims occurred',acts.includes('claim'));
  check('no ActRejected flood (<=10)',w.events.filter(e=>e.type==='ActRejected').length<=10);
  check('Dawn events fired',w.events.filter(e=>e.type==='Dawn').length>=10);
  // invariants
  let inv=true;
  for (const s of w.snapshots){
    for (const k of s.kingdoms){
      if(k.food<0||k.food>cfg.foodCap) inv=false;
      if(k.army<0||k.army>Math.min(cfg.armyCap,Math.max(k.pop,1))) inv=false;
      if(k.stamina<0||k.stamina>cfg.staminaCap) inv=false;
    }
  }
  check('state invariants held across all snapshots',inv);
  // speech occurred
  check('bulletins broadcast',w.events.some(e=>e.type==='Bulletin'));
  check('letters sent',w.events.some(e=>e.type==='Letter'));
  // determinism: same seed -> same event count and final food totals
  const w2=E.createWorld(cfg,42);
  for(let i=0;i<100;i++) await E.runTick(w2,thinkers);
  const f1=w.kingdoms.map(k=>k.food+','+k.pop+','+k.army).join('|');
  const f2=w2.kingdoms.map(k=>k.food+','+k.pop+','+k.army).join('|');
  check('deterministic replay (same seed, same end state)',f1===f2 && w.events.length===w2.events.length);

  // combat mechanics: force a raid
  const cfg2=E.defaultConfig(); cfg2.width=8;cfg2.height=8;cfg2.playerCount=2;cfg2.startArmy=3;cfg2.startStamina=4;
  const w3=E.createWorld(cfg2,7);
  // put kingdom 1 next to kingdom 0 manually
  w3.grid[0][0].owner=0; w3.grid[0][1].owner=1;
  const before=E.cellsOf(w3,0).length;
  E.executeAct(w3,0,{act:'raid',target:1,dir:null,note:'test'},w3.events);
  check('raid emits Combat event',w3.events.some(e=>e.type==='Combat'));

  // injects
  const w4=E.createWorld(cfg,9);
  for(let i=0;i<16;i++) await E.runTick(w4,thinkers);
  const cropsBefore=w4.grid.flat().filter(c=>c.crop>0).length;
  E.injectDrought(w4,0,0,7,7);
  const cropsAfter=w4.grid.flat().filter(c=>c.crop>0).length;
  check('drought clears crops',cropsAfter===0&&cropsBefore>0);
  E.injectCurfew(w4,16);
  const k0=w4.kingdoms[0];
  check('curfew removes raid from legal actions',!E.legalActions(w4,k0).includes('raid'));
  E.injectSilence(w4,8);
  const evc=w4.events.length;
  await E.runTick(w4,thinkers);
  check('radio silence suppresses bulletins',!w4.events.slice(evc).some(e=>e.type==='Bulletin'));
  E.injectMute(w4,1,8); w4.silenceUntil=0;
  const evc2=w4.events.length;
  await E.runTick(w4,thinkers);
  check('selective mute blocks that kingdoms bulletin',!w4.events.slice(evc2).some(e=>e.type==='Bulletin'&&e.kingdomId===1));
  E.injectCacheDrop(w4,3,3);
  check('cache drop spawns level-3 crop',w4.events.some(e=>e.type==='Control'&&e.operatorAction==='cache_drop'));

  // trade flow
  const cfg3=E.defaultConfig(); cfg3.width=8;cfg3.height=8;cfg3.playerCount=2;
  const w5=E.createWorld(cfg3,11);
  w5.grid[0][0].owner=0; w5.grid[0][1].owner=1;
  w5.kingdoms[0].food=10; w5.kingdoms[1].food=10;
  E.executeAct(w5,0,{act:'trade_offer',target:1},w5.events);
  E.executeAct(w5,1,{act:'honor'},w5.events);
  check('trade offer honored transfers food',w5.events.filter(e=>e.type==='Transfer').length===2);

  // sentence truncation
  const r=E.truncateSentences('One. Two! Three? Four.',2);
  check('sentence truncation to 2',r.truncated && r.text==='One. Two!');

  // dominion victory on tiny map
  const cfg4=E.defaultConfig(); cfg4.width=8;cfg4.height=8;cfg4.playerCount=2;cfg4.dominionPct=25;cfg4.endMode='dominion';
  const w6=E.createWorld(cfg4,3);
  for(let y=0;y<8;y++)for(let x=0;x<8;x++)w6.grid[y][x].owner=0;
  w6.grid[0][0].owner=1;
  E.checkVictory(w6);
  check('dominion victory triggers',w6.over&&w6.winner&&w6.winner.id===0&&w6.winner.how==='dominion');

  console.log(fails===0?'\nALL TESTS PASSED':'\n'+fails+' FAILURES');
  process.exit(fails?1:0);
})();
