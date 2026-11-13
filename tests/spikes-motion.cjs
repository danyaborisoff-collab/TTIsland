'use strict';
const assert=require('node:assert/strict');
const {edge}=require('../contour.js');
for(const length of [225,600,2000]){
 const count=Math.max(8,Math.floor(length/12));let min=Infinity,max=-Infinity,maxStep=0;
 for(let i=0;i<1000;i++){const t=i/1000,u=.5/count,value=edge('spikes',u,t,1,length);min=Math.min(min,value);max=Math.max(max,value);if(i)maxStep=Math.max(maxStep,Math.abs(value-edge('spikes',u,t-.001,1,length)));}
 assert(max-min>8.9,'visible amplitude');assert(max<12,'fits within 20px canvas margin');assert(maxStep<.051,'continuous movement');
 assert(Math.abs(edge('spikes',0,1,1,length)-edge('spikes',1,1,1,length))<1e-8,'closed seam');
 // A full cycle is approximately 2*pi/11 seconds, considerably faster than the previous version.
 assert(Math.abs(edge('spikes',.5/count,.1,1,length)-edge('spikes',.5/count,.1+2*Math.PI/11,1,length))<1e-7,'frequency');
}
console.log('PASS: spikes have wider range, faster cycle, bounded smooth movement, margin and seam');
