import { readFile } from 'node:fs/promises';

export const companyPictures = [
  'Sunrise_Introduction.jpg',
  'Sunrise_Lets_Connect.jpg',
  'Sunrise_Services.jpg'
];

export async function companyAttachments() {
  return Promise.all(companyPictures.map(async filename => ({
    filename,
    content: await readFile(new URL(`../public/email-assets/${filename}`, import.meta.url)),
    contentType: 'image/jpeg',
    contentDisposition: 'attachment'
  })));
}
