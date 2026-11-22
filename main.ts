import{readdirSync as a,readFileSync as b,writeFileSync as c,mkdirSync as d}from"node:fs";
let W,H,F,G,WC=0;
const D=[-1,1,0,0],E=[0,0,-1,1],C="udlr",I=1e9;
const N=(i,x)=>{let r=(i/W|0)+D[x],c=i%W+E[x];return r<0||r>=H||c<0||c>=W?-1:r*W+c};
const WL=(r,c)=>r<0||r>=H||c<0||c>=W||!F[r*W+c];
const BS=x=>{let s=new Uint8Array(W*H);for(let b of x)s[b]=1;return s};
function R(s,k){let S=new Uint8Array(W*H),q=[s],m=s;S[s]=1;for(let t=0;t<q.length;t++){let x=q[t];if(x<m)m=x;for(let z=0;z<4;z++){let y=N(x,z);if(y<0||!F[y]||k[y]||S[y])continue;S[y]=1;q.push(y)}}return[S,m]}
function P(a,b,k){if(a==b)return"";let p=new Int32Array(W*H).fill(-2),v=new Int8Array(W*H),q=[a];p[a]=-1;for(let t=0;t<q.length;t++){let x=q[t];for(let z=0;z<4;z++){let y=N(x,z);if(y<0||!F[y]||k[y]||p[y]!=-2)continue;p[y]=x;v[y]=z;if(y==b){let s="",u=b;while(u!=a){s=C[v[u]]+s;u=p[u]}return s}q.push(y)}}return null}
function Q(g){let o=[];for(let s of g){let d=new Int32Array(W*H).fill(-1),q=[s];d[s]=0;for(let t=0;t<q.length;t++){let x=q[t];for(let z=0;z<4;z++){let y=N(x,z);if(y<0||!F[y]||d[y]>-1)continue;d[y]=d[x]+1;q.push(y)}}o.push(d)}return o}
function A(c,n){let T=1<<n,y=new Float64Array(T).fill(I),p=new Uint8Array(T);y[0]=0;for(let m=1;m<T;m++)p[m]=p[m>>1]+(m&1);for(let m=0;m<T;m++){let k=p[m];if(k>=n||y[m]>=I)continue;for(let t=0;t<n;t++){if(m>>t&1)continue;let v=c[k][t];if(v>=I)continue;let z=m|1<<t;if(y[m]+v<y[z])y[z]=y[m]+v}}return y[T-1]}
function L(x,k){for(let b of x){if(G[b])continue;let r=(b/W|0),c=b%W,u=WL(r-1,c),d=WL(r+1,c),l=WL(r,c-1),g=WL(r,c+1);if(u&&l||u&&g||d&&l||d&&g)return 1;
for(let tr=r-1;tr<=r;tr++)for(let tc=c-1;tc<=c;tc++){if(tr<0||tc<0||tr+1>=H||tc+1>=W)continue;let f=1,o=0;for(let s=0;s<4;s++){let y=(tr+(s>>1))*W+tc+(s&1);if(F[y]&&!k[y]){f=0;break}if(k[y]&&!G[y])o=1}if(f&&o)return 1}
if(u||d){let s=c;while(s>0&&F[r*W+s-1]&&(WL(r-1,s-1)||WL(r+1,s-1)))s--;let e=c;while(e+1<W&&F[r*W+e+1]&&(WL(r-1,e+1)||WL(r+1,e+1)))e++;if((s==0||!F[r*W+s-1])&&(e==W-1||!F[r*W+e+1])){let h=0;for(let v=s;v<=e;v++)if(G[r*W+v])h=1;if(!h)return 1}}
if(l||g){let s=r;while(s>0&&F[(s-1)*W+c]&&(WL(s-1,c-1)||WL(s-1,c+1)))s--;let e=r;while(e+1<H&&F[(e+1)*W+c]&&(WL(e+1,c-1)||WL(e+1,c+1)))e++;if((s==0||!F[(s-1)*W+c])&&(e==H-1||!F[(e+1)*W+c])){let h=0;for(let v=s;v<=e;v++)if(G[v*W+c])h=1;if(!h)return 1}}
}return 0}
function S(fl,bx,pl,ex,bd){let o=F;F=fl;let r=T(bx,pl,ex,bd);F=o;return r}
function T(bx0,pl0,ex,bd){let n=bx0.length,gs=[];for(let i=0;i<W*H;i++)if(G[i]&&F[i])gs.push(i);if(gs.length!=n)return null;let dg=Q(gs);
const hf=bx=>{if(n<=8){let c=[];for(let i=0;i<n;i++){let q=[];for(let t=0;t<n;t++)q.push(dg[t][bx[i]]<0?I:dg[t][bx[i]]);c.push(q)}return A(c,n)}let s=0;for(let i=0;i<n;i++){let v=I;for(let t=0;t<n;t++)v=Math.min(v,dg[t][bx[i]]<0?I:dg[t][bx[i]]);if(v>=I)return I;s+=v}return s};
let sb=[...bx0].sort((x,y)=>x-y),bs=BS(sb);if(L(sb,bs))return null;let sp=R(pl0,bs)[1],h0=hf(sb);if(h0>=I)return null;
let NB=[sb],NP=[sp],NG=[0],NF=[h0],NH=[h0],NA=[-1],NU=[null],NQ=[0],sq=1,hp=[0];
const ls=(x,y)=>NF[x]!=NF[y]?NF[x]<NF[y]:NH[x]!=NH[y]?NH[x]<NH[y]:NQ[x]<NQ[y];
const pu=id=>{hp.push(id);let i=hp.length-1;while(i>0){let p=(i-1)>>1;if(!ls(hp[i],hp[p]))break;let t=hp[i];hp[i]=hp[p];hp[p]=t;i=p}};
const po=()=>{let t=hp[0],l=hp.pop();if(hp.length){hp[0]=l;let i=0;for(;;){let x=i*2+1,y=x+1,m=i;if(x<hp.length&&ls(hp[x],hp[m]))m=x;if(y<hp.length&&ls(hp[y],hp[m]))m=y;if(m==i)break;let z=hp[i];hp[i]=hp[m];hp[m]=z;i=m}}return t};
const ky=(x,y)=>x.join()+"/"+y;let cl=new Map([[ky(sb,sp),0]]);
const sv=x=>{for(let i=0;i<n;i++)if(!G[x[i]])return 0;return 1};
const rc=id=>{let o=[],c=id;while(c>0){o.push(NU[c]);c=NA[c]}return o.reverse()};
let ex2=0;
while(hp.length){let id=po(),bx=NB[id],pl=NP[id],g=NG[id],bv=cl.get(ky(bx,pl));if(bv!==undefined&&bv<g)continue;
if(sv(bx)){if(ex<0)return rc(id);if(R(pl,BS(bx))[0][ex])return rc(id)}
if(ex2>=bd||WC>=8e5)return null;ex2++;WC++;
let st=BS(bx),rg=R(pl,st);
for(let bi=0;bi<n;bi++){let b=bx[bi];for(let z=0;z<4;z++){let bh=N(b,z^1),tg=N(b,z);if(bh<0||tg<0||!F[bh]||!F[tg]||st[tg]||!rg[0][bh])continue;
let nb=[...bx];nb[bi]=tg;nb.sort((x,y)=>x-y);let ns=BS(nb);if(L(nb,ns))continue;let hh=hf(nb);if(hh>=I)continue;
let np=R(b,ns)[1],ng=g+1,k=ky(nb,np),pv=cl.get(k);if(pv!==undefined&&pv<=ng)continue;cl.set(k,ng);
let ni=NB.length;NB.push(nb);NP.push(np);NG.push(ng);NH.push(hh);NF.push(ng+hh);NA.push(id);NU.push({f:b,t:tg,d:z});NQ.push(sq++);pu(ni)}}}
return null}
function M(pl0,bx0,ps){let m="",pl=pl0,bx=new Set(bx0);for(let p of ps){let k=BS([...bx]),bh=N(p.f,p.d^1),w=P(pl,bh,k);if(w===null)return null;m+=w+C[p.d];bx.delete(p.f);bx.add(p.t);pl=p.f}return{m,pl,bx}}
function V(lv,m){let bx=new Set(lv.b),pl=lv.p;for(let ch of m){let d=C.indexOf(ch);if(d<0)return 0;let nx=N(pl,d);if(nx<0||!F[nx])return 0;if(bx.has(nx)){let by=N(nx,d);if(by<0||!F[by]||bx.has(by))return 0;bx.delete(nx);bx.add(by)}pl=nx}for(let b of bx)if(!G[b])return 0;return 1}
function K(t){let r=t.split("\n").filter(x=>x.length),h=r.length,w=0;for(let s of r)w=Math.max(w,s.length);F=new Uint8Array(w*h);G=new Uint8Array(w*h);let bx=[],pl=-1;W=w;H=h;for(let y=0;y<h;y++)for(let x=0;x<r[y].length;x++){let ch=r[y][x];if(ch=="#")continue;let i=y*w+x;F[i]=1;if(ch=="."||ch=="*"||ch=="+")G[i]=1;if(ch=="$"||ch=="*")bx.push(i);if(ch=="@"||ch=="+")pl=i}bx.sort((x,y)=>x-y);return{b:bx,p:pl}}
function Z(lv,rm){let dr=Math.min(...rm.d),r=(dr/W|0),c=dr%W,hr=(lv.p/W|0),e=-1;for(let z=0;z<4;z++){let nr=r+D[z],nc=c+E[z];if(nr<0||nr>=H||nc<0||nc>=W)continue;let ni=nr*W+nc;if(((ni/W|0)==hr)&&F[ni]&&(e<0||ni<e))e=ni}return e}
function Y(lv,rm,xr){let dr=Math.min(...rm.d),e=Z(lv,rm);if(e<0)return null;let m=new Uint8Array(W*H);for(let c of rm.c)m[c]=1;m[e]=1;return S(m,rm.b,e,xr?dr:-1,12e4)}
function O(lv,rms){let o=[...rms].sort((x,y)=>Math.min(...x.d)-Math.min(...y.d)),pl=[],df=[];for(let rm of o){let p=Y(lv,rm,1);if(p)pl.push({e:Z(lv,rm),ps:p});else df.push(rm)}for(let rm of df){let p=Y(lv,rm,0);if(!p)return null;pl.push({e:Z(lv,rm),ps:p})}let m="",pp=lv.p,bx=new Set(lv.b);for(let q of pl){let k=BS([...bx]),w=P(pp,q.e,k);if(w===null)return null;m+=w;let r=M(q.e,bx,q.ps);if(!r)return null;m+=r.m;pp=r.pl;bx=r.bx}return V(lv,m)?m:null}
function U(lv){let bx=lv.b,pl=lv.p;if(pl<0||!bx.length||bx.every(b=>G[b]))return"";let hr=(pl/W|0),ci=new Int32Array(W*H).fill(-1),cm=[];
for(let i=0;i<W*H;i++){if(!F[i]||((i/W|0)==hr)||ci[i]>=0)continue;let id=cm.length,cl2=[],q=[i];ci[i]=id;for(let t=0;t<q.length;t++){let x=q[t];cl2.push(x);let r=(x/W|0),c=x%W;for(let z=0;z<4;z++){let nr=r+D[z],nc=c+E[z];if(nr<0||nr>=H||nc<0||nc>=W||nr==hr)continue;let y=nr*W+nc;if(!F[y]||ci[y]>=0)continue;ci[y]=id;q.push(y)}}cm.push(cl2)}
let dc=true,cb=0,rm=[];
for(let cl2 of cm){let d=[],b=[],g=[],s=new Set(cl2);for(let cell of cl2){if(G[cell])g.push(cell);if(bx.includes(cell))b.push(cell);let r=(cell/W|0),c=cell%W;for(let z=0;z<4;z++){let nr=r+D[z],nc=c+E[z];if(nr<0||nr>=H||nc<0||nc>=W)continue;let y=nr*W+nc;if(((y/W|0)==hr)&&F[y]&&!s.has(y)){d.push(cell);break}}}if(!b.length){if(g.length)dc=false;continue}if(b.length!=g.length||!d.length){dc=false;break}cb+=b.length;rm.push({c:cl2,d,b})}
if(dc&&cb==bx.length&&rm.length){let r=O(lv,rm);if(r!==null)return r}
let ps=S(F,bx,pl,-1,2e5);if(ps){let r=M(pl,new Set(bx),ps);if(r&&V(lv,r.m))return r.m}return""}
let I2=process.env.MAKEFUN_INPUT_DIR||"/input",O2=process.env.MAKEFUN_OUTPUT_DIR||"/output";
for(let id of a(I2).sort()){let m="";try{let lv=K(b(I2+"/"+id+"/level.txt","utf8"));m=U(lv)}catch{m=""}d(O2+"/"+id,{recursive:true});c(O2+"/"+id+"/solution.txt",m+"\n")}
