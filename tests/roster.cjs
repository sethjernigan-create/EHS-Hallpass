const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');const root=path.resolve(__dirname,'..');
const core=require('../roster-core.js');let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
const csv='\uFEFFStudent Id,Grade,First Name,Last Name,Email - Student\r\n00123,10,Test,"O\'Example, Jr.",ignored@example.com\r\n00456,11,Sample,Student,ignored2@example.com\r\n';
test('Matches supplied headers; preserves leading zeros, quoted commas and names; drops email',()=>{const students=core.parseRoster(csv);assert.equal(students[0].id,'00123');assert.equal(students[0].last,"O'Example, Jr.");assert.deepEqual(Object.keys(students[0]),['id','first','last','grade']);});
test('Rejects ambiguous IDs, missing names and malformed CSV',()=>{assert.throws(()=>core.parseRoster(csv+'00123,12,Other,Student,x\n'),/Duplicate/);assert.throws(()=>core.parseRoster('Student Id,First Name,Last Name\n99,,Test'),/name/);assert.throws(()=>core.parseRoster('Student Id,First Name,Last Name\n99,"Unfinished,Test'),/quoted/);assert.throws(()=>core.parseRoster('Name,Email\nTest,test@example.com'),/Required/);});
test('Supports quoted line breaks and optional grade',()=>{const students=core.parseRoster('Student ID#,First Name,Last Name\n001,"Test\nName","Last ""Quoted"""');assert.equal(students[0].grade,'');assert.equal(students[0].last,'Last "Quoted"');});
console.log(count+" CSV parser checks passed.");
