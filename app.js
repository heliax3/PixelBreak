const canvas = document.querySelector('#game-canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score'), highEl = document.querySelector('#high-score');
const overlay = document.querySelector('#overlay');
let game = null, state = {}, animation, lastTime = 0;
let tetrisPointerX = null;
const colors = ['#ff5a36','#ffc83d','#56c6e7','#7865e9','#82ca6b','#ff9e4a','#ed6ac5'];
const shopItems = [
  {id:'tetrisSlow', icon:'🐢', name:'Tetris Chill Mode', desc:'Slows falling pieces for easier stacking.', price:150, type:'powerup'},
  {id:'tetrisDouble', icon:'✨', name:'Tetris Double Score', desc:'Cleared lines award twice as many points.', price:275, type:'powerup'},
  {id:'pongWide', icon:'🏓', name:'Pong Mega Paddle', desc:'Makes your mouse-controlled paddle bigger.', price:200, type:'powerup'},
  {id:'pongCalm', icon:'🫧', name:'Pong Calm Ball', desc:'Slows the ball down so rallies last longer.', price:275, type:'powerup'},
  {id:'snakeShield', icon:'🛡️', name:'Snake Shield', desc:'Survive one wall or tail crash each round.', price:250, type:'powerup'},
  {id:'snakeBonus', icon:'🍎', name:'Snake Bonus Food', desc:'Each food pickup earns double points.', price:275, type:'powerup'},
  {id:'badgeStar', icon:'🌟', name:'High Scorer Badge', desc:'A shiny badge for your collection.', price:300, type:'badge'},
  {id:'badgeRainbow', icon:'🌈', name:'Rainbow Badge', desc:'A colorful badge for your collection.', price:450, type:'badge'}
];
const walletKey='pixel-break-points', inventoryKey='pixel-break-inventory';
function currentKey(name=game){return `pixel-break-${name}-current`}
function wallet(){return +(localStorage.getItem(walletKey)||0)}
function inventory(){try{return JSON.parse(localStorage.getItem(inventoryKey)||'[]')}catch{return []}}
function renderShop(){const points=wallet(), owned=inventory(), slot=Math.floor(Date.now()/1800000), powerups=shopItems.filter(i=>i.type==='powerup'), badges=shopItems.filter(i=>i.type==='badge'), rotated=powerups.map((_,i)=>powerups[(i+slot)%powerups.length]), offers=[...rotated,...badges];document.querySelector('#wallet-points').textContent=points;document.querySelector('#shop-points').textContent=points;const remaining=1800000-(Date.now()%1800000),mins=Math.floor(remaining/60000),secs=String(Math.floor(remaining/1000)%60).padStart(2,'0');document.querySelector('#shop-refresh').textContent=`New powerup lineup in ${mins}:${secs}`;document.querySelector('#shop-items').innerHTML=offers.map(item=>{const has=owned.includes(item.id);return `<article class="shop-item ${has?'owned':''}"><h3>${item.icon} ${item.name}</h3><p>${item.desc}</p><span class="price">${item.type==='badge'?'Collect':'Powerup'} · ${item.price} ⭐</span><button data-buy="${item.id}" ${has?'disabled':''}>${has?'Owned ✓':'Buy'}</button></article>`}).join('');document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>buy(b.dataset.buy))}
function buy(id){const item=shopItems.find(i=>i.id===id), owned=inventory();if(!item||owned.includes(id)||wallet()<item.price)return;localStorage.setItem(walletKey,wallet()-item.price);localStorage.setItem(inventoryKey,JSON.stringify([...owned,id]));renderShop()}
function earnPoints(amount){if(amount>0)localStorage.setItem(walletKey,wallet()+amount);renderShop()}
function renderProfile(){const badges=shopItems.filter(i=>i.type==='badge'&&inventory().includes(i.id));document.querySelector('#profile-points').textContent=wallet();document.querySelector('#profile-badges').innerHTML=badges.length?badges.map(b=>`<span class="badge-pill">${b.icon} ${b.name}</span>`).join(''):'<span class="badge-empty">No badges yet — visit the Prize Shop to collect one!</span>';document.querySelector('#profile-scores').innerHTML=[['Tetris','tetris'],['Pong','pong'],['Snake','snake']].map(([label,id])=>`<div class="profile-score"><span>${label}</span><strong>${+localStorage.getItem(`pixel-break-${id}-high`)||0}</strong></div>`).join('')}

document.querySelectorAll('.game-card').forEach(card => card.addEventListener('click', () => start(card.dataset.game)));
document.querySelector('#shop-button').onclick=()=>{renderShop();document.querySelector('#shop').classList.add('open')};
document.querySelector('#close-shop').onclick=()=>document.querySelector('#shop').classList.remove('open');
setInterval(()=>{if(document.querySelector('#shop').classList.contains('open'))renderShop()},1000);
document.querySelector('#back-button').onclick = () => { stop(); document.querySelector('#game').classList.remove('active'); document.querySelector('#home').classList.add('active'); };
document.querySelector('#restart-button').onclick = () => {localStorage.removeItem(currentKey());start(game)};
document.querySelector('#profile-button').onclick=()=>{renderProfile();document.querySelector('#profile').classList.add('open')};
document.querySelector('#close-profile').onclick=()=>document.querySelector('#profile').classList.remove('open');
document.addEventListener('keydown', e => { if (!game || state.ended) return; const k=e.key.toLowerCase(); if(['arrowleft','arrowright','arrowup','arrowdown',' '].includes(k)) e.preventDefault(); if(game==='tetris'&&(k==='arrowdown'||k==='s')) state.softDrop=true; handleInput(k); });
document.addEventListener('keyup', e => { const k=e.key.toLowerCase(); if(game==='tetris'&&(k==='arrowdown'||k==='s')) state.softDrop=false; });
document.querySelectorAll('[data-control]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();handleInput(b.dataset.control)}));
canvas.addEventListener('pointerdown', e => {
  if (game === 'tetris' && !state.ended) {
    tetrisPointerX = e.clientX;
    canvas.setPointerCapture?.(e.pointerId);
  }
});
canvas.addEventListener('pointermove', e => {
  if (state.ended) return;
  if (game === 'pong') {
    const box = canvas.getBoundingClientRect();
    const y = (e.clientY - box.top) * (canvas.height / box.height);
    state.targetPaddle = Math.max(0, Math.min(320, y - 40));
  }
  if (game === 'tetris' && tetrisPointerX !== null) {
    const step = 20;
    const distance = e.clientX - tetrisPointerX;
    if (Math.abs(distance) >= step) {
      move(Math.sign(distance));
      tetrisPointerX = e.clientX;
    }
  }
});
canvas.addEventListener('pointerup', () => { tetrisPointerX = null; });
canvas.addEventListener('pointercancel', () => { tetrisPointerX = null; });
function highKey(){return `pixel-break-${game}-high`}; function high(){return +localStorage.getItem(highKey())||0}
function setScore(n){const gained=Math.max(0,n-(state.score||0));state.score=n;localStorage.setItem(currentKey(),n);scoreEl.textContent=n;if(gained)earnPoints(gained);if(n>high()){localStorage.setItem(highKey(),n);highEl.textContent=n}renderProfile()}
function stop(){cancelAnimationFrame(animation);}
function start(name){stop();game=name;state={score:+localStorage.getItem(`pixel-break-${name}-current`)||0,ended:false};tetrisPointerX=null;const tetris=name==='tetris';canvas.width=tetris?200:400;canvas.height=400;document.querySelector('.board-wrap').classList.toggle('tetris-board',tetris);document.querySelector('#home').classList.remove('active');document.querySelector('#game').classList.add('active');document.querySelector('#game-title').textContent=name==='snake'?'Snake':name[0].toUpperCase()+name.slice(1);highEl.textContent=high();overlay.classList.add('hidden');document.querySelector('#instructions').textContent={tetris:'← → or A / D move · hold ↓ to drop faster',pong:'Move your mouse over the board to control the paddle',snake:'Arrow keys to turn. Don’t crash!'}[name];setScore(state.score);if(tetris)initTetris();if(name==='pong')initPong();if(name==='snake')initSnake();lastTime=performance.now();animation=requestAnimationFrame(loop)}
function end(message){state.ended=true;overlay.innerHTML=`<div>${message}<small>Press Restart to try again</small></div>`;overlay.classList.remove('hidden');}
function loop(time){let dt=time-lastTime;lastTime=time;if(!state.ended){if(game==='tetris')drawTetris(dt);if(game==='pong')drawPong(dt);if(game==='snake')drawSnake(dt)}animation=requestAnimationFrame(loop)}
function handleInput(k){if(game==='tetris'){if(k==='arrowleft'||k==='left'||k==='a')move(-1);if(k==='arrowright'||k==='right'||k==='d')move(1);if(k==='arrowdown'||k==='down'||k==='s')drop();if(k==='arrowup'||k==='up'||k==='w'||k===' ')rotate()}if(game==='pong'){if(k==='w'||k==='arrowup'||k==='up')state.targetPaddle=Math.max(0,state.targetPaddle-38);if(k==='s'||k==='arrowdown'||k==='down')state.targetPaddle=Math.min(320,state.targetPaddle+38)}if(game==='snake'){let dir={arrowleft:[-1,0],left:[-1,0],arrowright:[1,0],right:[1,0],arrowup:[0,-1],up:[0,-1],arrowdown:[0,1],down:[0,1]}[k];if(dir&&!(dir[0]===-state.dir[0]&&dir[1]===-state.dir[1]))state.nextDir=dir}}
function clear(){ctx.fillStyle='#172128';ctx.fillRect(0,0,400,400)}
// Tetris
const pieces=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]]];
function initTetris(){state.board=Array.from({length:20},()=>Array(10).fill(0));state.drop=0;state.softDrop=false;const items=inventory();state.dropInterval=items.includes('tetrisSlow')?950:650;state.doubleScore=items.includes('tetrisDouble');newPiece()}
function newPiece(){let shape=pieces[Math.floor(Math.random()*pieces.length)].map(r=>[...r]);state.piece={shape,x:Math.floor((10-shape[0].length)/2),y:0,c:colors[Math.floor(Math.random()*colors.length)]};if(collide())end('Game over!')}
function collide(p=state.piece){return p.shape.some((r,y)=>r.some((v,x)=>v&&(p.x+x<0||p.x+x>=10||p.y+y>=20||(p.y+y>=0&&state.board[p.y+y][p.x+x]))))}
function move(n){const next={...state.piece,x:state.piece.x+n};if(!collide(next))state.piece.x=next.x}function rotate(){let old=state.piece.shape;state.piece.shape=old[0].map((_,i)=>old.map(r=>r[i]).reverse());if(collide())state.piece.shape=old}function drop(){state.piece.y++;if(collide()){state.piece.y--;lock()}}
function lock(){let p=state.piece;p.shape.forEach((r,y)=>r.forEach((v,x)=>{if(v&&p.y+y>=0)state.board[p.y+y][p.x+x]=p.c}));let cleared=0;state.board=state.board.filter(r=>{if(r.every(Boolean)){cleared++;return false}return true});while(state.board.length<20)state.board.unshift(Array(10).fill(0));if(cleared)setScore(state.score+[0,100,300,500,800][cleared]*(state.doubleScore?2:1));if(state.score>=3000){end('You win!');return}newPiece()}
function cell(x,y,c){ctx.fillStyle=c;ctx.fillRect(x*20+1,y*20+1,18,18)}function drawTetris(dt){state.drop+=dt;const interval=state.softDrop?65:state.dropInterval;if(state.drop>interval){drop();state.drop=0}clear();state.board.forEach((r,y)=>r.forEach((c,x)=>{if(c)cell(x,y,c)}));state.piece.shape.forEach((r,y)=>r.forEach((v,x)=>{if(v)cell(state.piece.x+x,state.piece.y+y,state.piece.c)}))}
// Pong
function initPong(){const items=inventory();Object.assign(state,{paddle:150,targetPaddle:150,paddleSize:items.includes('pongWide')?110:80,ai:150,ball:{x:200,y:200,vx:items.includes('pongCalm')?3.5:4.5,vy:2.8},player:0,opponent:0})}function drawPong(dt){clear();ctx.fillStyle='#f7f2e9';for(let y=0;y<400;y+=20)ctx.fillRect(198,y,4,10);state.paddle+=(state.targetPaddle-state.paddle)*Math.min(1,dt/55);ctx.fillRect(16,state.paddle,10,state.paddleSize);ctx.fillRect(374,state.ai,10,80);let b=state.ball;b.x+=b.vx;b.y+=b.vy;if(b.y<9||b.y>391){b.y=Math.max(9,Math.min(391,b.y));b.vy*=-1}const aiTarget=Math.max(0,Math.min(320,b.y-40));state.ai+=(aiTarget-state.ai)*Math.min(.12,dt/180);if(b.x<30&&b.x>14&&b.y>state.paddle-8&&b.y<state.paddle+state.paddleSize+8){b.x=30;b.vx=Math.abs(b.vx)*1.035;b.vy+=(b.y-(state.paddle+state.paddleSize/2))*.045}if(b.x>370&&b.x<386&&b.y>state.ai-8&&b.y<state.ai+88){b.x=370;b.vx=-Math.abs(b.vx)*1.035;b.vy+=(b.y-(state.ai+40))*.04}b.vy=Math.max(-6,Math.min(6,b.vy));if(b.x<0||b.x>400){if(b.x<0)state.opponent++;else{state.player++;setScore(state.score+100)}if(state.player===7||state.opponent===7){end(state.player===7?'You win!':'Computer wins!');return}Object.assign(b,{x:200,y:200,vx:b.x<0?(state.ball.vx<0?3.5:4.5):(state.ball.vx<0?-4.5:-3.5),vy:(Math.random()-.5)*5})}ctx.beginPath();ctx.arc(b.x,b.y,9,0,7);ctx.fill();ctx.font='20px DM Mono';ctx.fillText(state.player,160,35);ctx.fillText(state.opponent,230,35)}
// Snake
function initSnake(){const items=inventory();Object.assign(state,{snake:[[10,10],[9,10],[8,10]],dir:[1,0],nextDir:[1,0],food:food(),tick:0,shield:items.includes('snakeShield'),foodValue:items.includes('snakeBonus')?20:10})}function food(){let p;do p=[Math.floor(Math.random()*20),Math.floor(Math.random()*20)];while(state.snake?.some(s=>s[0]===p[0]&&s[1]===p[1]));return p}function drawSnake(dt){state.tick+=dt;if(state.tick<115)return;state.tick=0;state.dir=state.nextDir;let h=[state.snake[0][0]+state.dir[0],state.snake[0][1]+state.dir[1]],crash=h[0]<0||h[0]>=20||h[1]<0||h[1]>=20||state.snake.some(s=>s[0]===h[0]&&s[1]===h[1]);if(crash&&state.shield){state.shield=false;state.dir=[-state.dir[0],-state.dir[1]];state.nextDir=state.dir;return}if(crash){end('Game over!');return}state.snake.unshift(h);if(h[0]===state.food[0]&&h[1]===state.food[1]){setScore(state.score+state.foodValue);if(state.score>=150){end('You win!');return}state.food=food()}else state.snake.pop();clear();cell(state.food[0],state.food[1],'#ff5a36');state.snake.forEach((s,i)=>cell(s[0],s[1],i?'#82ca6b':'#ffc83d'))}
