import test from 'node:test';
import assert from 'node:assert/strict';
import {companyAttachments} from '../lib/attachments.mjs';
import nodemailer from 'nodemailer';

test('outreach MIME includes all three genuine JPEG attachments',async()=>{
  const pictures=await companyAttachments();
  assert.equal(pictures.length,3);
  for(const picture of pictures){assert.equal(picture.content.subarray(0,3).toString('hex'),'ffd8ff');assert.equal(picture.contentDisposition,'attachment');}
  const transport=nodemailer.createTransport({streamTransport:true,buffer:true});
  const message=await transport.sendMail({from:'info@sunrisetechorigin.com',to:'test@example.com',subject:'Local attachment verification',text:'Local MIME check. This email is not sent.',attachments:pictures});
  const raw=message.message.toString();
  for(const picture of pictures)assert.ok(raw.includes(picture.filename));
  assert.equal((raw.match(/Content-Type: image\/jpeg/g)||[]).length,3);
});
