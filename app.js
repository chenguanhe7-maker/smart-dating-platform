// ===== Utilities =====
const load = (k, fallback) => JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback));
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

// Seed initial store
const store = {
  users: load('users', []),
  sessions: load('sessions', { currentUser: null }),
  reviews: load('reviews', []),
  matches: load('matches', {}) // by username: [otherUsernames]
};

function updateAuthStatus(){
  const s = load('sessions', { currentUser: null });
  const el = document.getElementById('authStatus');
  el.textContent = s.currentUser ? `Logged in as: ${s.currentUser}` : 'Not logged in';
}

// ===== Register/Login =====
document.getElementById('registerForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const username = fd.get('username').trim();
  const password = fd.get('password').trim();
  if(!username || !password) return alert('Username & password required');
  const age = parseInt(fd.get('age'));
  const gender = fd.get('gender');
  const hobbies = (fd.get('hobbies')||'').split(',').map(s=>s.trim()).filter(Boolean);
  const interests = (fd.get('interests')||'').split(',').map(s=>s.trim()).filter(Boolean);

  const users = load('users', []);
  if(users.find(u=>u.username===username)) return alert('Username already exists');
  users.push({username, password, age, gender, hobbies, interests});
  save('users', users);
  alert('Registered! Now you can login.');
  e.target.reset();
  renderUsers();
});

document.getElementById('loginForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const username = fd.get('username').trim();
  const password = fd.get('password').trim();
  const users = load('users', []);
  const u = users.find(x=>x.username===username && x.password===password);
  if(!u) return alert('Invalid credentials');
  const sessions = load('sessions', { currentUser: null });
  sessions.currentUser = username;
  save('sessions', sessions);
  updateAuthStatus();
  renderMatchesList();
});

document.getElementById('logoutBtn').addEventListener('click', ()=>{
  const sessions = load('sessions', { currentUser: null });
  sessions.currentUser = null;
  save('sessions', sessions);
  updateAuthStatus();
  renderMatchesList();
});

// ===== Catalogue & Filtering =====
function userCard(u){
  return `<div class="user-card">
    <h4>${u.username} (${u.age}, ${u.gender})</h4>
    <div>${u.hobbies.map(h=>`<span class="badge">${h}</span>`).join(' ')}</div>
    <div>${u.interests.map(h=>`<span class="badge">${h}</span>`).join(' ')}</div>
    <button onclick="addMatch('${u.username}')">Add to my matches</button>
  </div>`;
}

function renderUsers(){
  const users = load('users', []);
  const list = document.getElementById('userList');
  const minAge = parseInt(document.getElementById('minAge').value || 0);
  const maxAge = parseInt(document.getElementById('maxAge').value || 200);
  const gender = document.getElementById('filterGender').value;
  const hobby = document.getElementById('filterHobby').value.toLowerCase();
  const interest = document.getElementById('filterInterest').value.toLowerCase();
  const filtered = users.filter(u=>
    (u.age>=minAge && u.age<=maxAge) &&
    (!gender || u.gender===gender) &&
    (!hobby || u.hobbies.some(h=>h.toLowerCase().includes(hobby))) &&
    (!interest || u.interests.some(i=>i.toLowerCase().includes(interest)))
  );
  list.innerHTML = filtered.map(userCard).join('') || '<p>No users yet.</p>';
}
document.getElementById('applyFilters').addEventListener('click', renderUsers);

document.getElementById('seedBtn').addEventListener('click', ()=>{
  const samples = [
    {username:'alice', password:'123', age:24, gender:'female', hobbies:['hiking','yoga'], interests:['art','coffee']},
    {username:'bob', password:'123', age:27, gender:'male', hobbies:['games','basketball'], interests:['tech','movies']},
    {username:'coco', password:'123', age:22, gender:'female', hobbies:['cooking','reading'], interests:['travel','music']},
    {username:'dylan', password:'123', age:30, gender:'male', hobbies:['running','chess'], interests:['books','startups']},
    {username:'emma', password:'123', age:26, gender:'non-binary', hobbies:['photography','gaming'], interests:['design','anime']}
  ];
  const users = load('users', []);
  for(const s of samples){ if(!users.find(u=>u.username===s.username)) users.push(s); }
  save('users', users);
  renderUsers();
  alert('Seeded sample users. Login with any sample (password: 123) to try matching & chat.');
});

// ===== Matching =====
function matchScore(me, other){
  if(me.username===other.username) return -1;
  let score = 0;
  const ageDiff = Math.abs((me.age||0) - (other.age||0));
  score += Math.max(0, 10 - ageDiff); // similar age
  const sharedHobbies = me.hobbies.filter(h=>other.hobbies.includes(h)).length;
  const sharedInterests = me.interests.filter(i=>other.interests.includes(i)).length;
  score += sharedHobbies*5 + sharedInterests*3;
  return score;
}

function addMatch(username){
  const sessions = load('sessions', { currentUser: null });
  if(!sessions.currentUser) return alert('Login first');
  const me = sessions.currentUser;
  const matches = load('matches', {});
  matches[me] = matches[me] || [];
  if(!matches[me].includes(username)) matches[me].push(username);
  save('matches', matches);
  renderMatchesList();
  alert('Added to your match list.');
}

document.getElementById('findMatchesBtn').addEventListener('click', ()=>{
  const sessions = load('sessions', { currentUser: null });
  if(!sessions.currentUser) return alert('Login first');
  const meName = sessions.currentUser;
  const users = load('users', []);
  const me = users.find(u=>u.username===meName);
  const candidates = users
    .map(u=>({u, score:matchScore(me,u)}))
    .filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score)
    .slice(0,5);
  const container = document.getElementById('matchResults');
  container.innerHTML = candidates.map(({u,score})=>`
    <div class="match-card">
      <h4>${u.username} — Score ${score}</h4>
      <div>${u.hobbies.map(h=>`<span class="badge">${h}</span>`).join(' ')}</div>
      <div>${u.interests.map(h=>`<span class="badge">${h}</span>`).join(' ')}</div>
      <button onclick="addMatch('${u.username}')">Add to My Matches</button>
    </div>
  `).join('') || '<p>No candidates found. Add more users.</p>';
});

// ===== Chat =====
let activeChatUser = null;

function renderMatchesList(){
  const sessions = load('sessions', { currentUser: null });
  const me = sessions.currentUser;
  const list = document.getElementById('chatMatches');
  if(!me){ list.innerHTML = '<p>Login to see matches.</p>'; return; }
  const matches = load('matches', {});
  const my = matches[me] || [];
  list.innerHTML = my.map(m=>`<div class="user-card"><h4>${m}</h4><button onclick="openChat('${m}')">Open Chat</button></div>`).join('') || '<p>No matches yet.</p>';
}

function openChat(other){
  activeChatUser = other;
  document.getElementById('chatWith').textContent = `Conversation with ${other}`;
  renderChat();
}

function renderChat(){
  const box = document.getElementById('chatBox');
  const s = load('sessions', { currentUser: null });
  const me = s.currentUser;
  if(!me || !activeChatUser){ box.innerHTML = '<p>Select a match to chat.</p>'; return; }
  const key = `chat:${[me,activeChatUser].sort().join('|')}`;
  const msgs = load(key, []);
  box.innerHTML = msgs.map(m=>`<div class="msg ${m.from===me?'me':''}"><small>${m.from}</small><div>${m.text}</div></div>`).join('');
  box.scrollTop = box.scrollHeight;
}

document.getElementById('chatForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if(!text) return;
  const s = load('sessions', { currentUser: null });
  const me = s.currentUser;
  if(!me || !activeChatUser) return alert('Open a chat first');
  const key = `chat:${[me,activeChatUser].sort().join('|')}`;
  const msgs = load(key, []);
  msgs.push({ from: me, text, ts: Date.now() });
  save(key, msgs);
  input.value='';
  renderChat();
});

// ===== Reviews =====
function renderReviews(){
  const list = document.getElementById('reviewList');
  const reviews = load('reviews', []);
  list.innerHTML = reviews.map(r=>`<div class="review-card"><strong>★${r.rating}</strong> — ${r.comment}</div>`).join('') || '<p>No reviews yet.</p>';
}
document.getElementById('reviewForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const rating = document.getElementById('rating').value;
  const comment = document.getElementById('reviewComment').value.trim();
  const reviews = load('reviews', []);
  reviews.unshift({ rating, comment, ts: Date.now() });
  save('reviews', reviews);
  renderReviews();
  e.target.reset();
});

// Boot
updateAuthStatus();
renderUsers();
renderMatchesList();
renderReviews();
