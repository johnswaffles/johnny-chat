const fs = require('fs');
const path = require('path');

const tortasEnhancerPath = '/Users/johnshopinski/.gemini/antigravity/brain/5cb4873b-6ae3-4178-8a9b-b5b0c2679750/uploaded_image_0_1765484265205.jpg';
const flautasEnhancerPath = '/Users/johnshopinski/.gemini/antigravity/brain/5cb4873b-6ae3-4178-8a9b-b5b0c2679750/uploaded_image_1_1765484265205.jpg';
const targetHtmlPath = '/Users/johnshopinski/johnny-chat-1/tacos_squarespace_embed.html';

const tortasUrl = 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?q=80&w=1080&auto=format&fit=crop';
const flautasUrl = 'https://images.unsplash.com/photo-1615870216519-2f9fa575fa5c?q=80&w=1080&auto=format&fit=crop';

try {
    console.log('Reading files...');
    const tortasBuffer = fs.readFileSync(tortasEnhancerPath);
    const flautasBuffer = fs.readFileSync(flautasEnhancerPath);
    let htmlContent = fs.readFileSync(targetHtmlPath, 'utf8');

    console.log('Converting to Base64...');
    const tortasBase64 = `data:image/jpeg;base64,${tortasBuffer.toString('base64')}`;
    const flautasBase64 = `data:image/jpeg;base64,${flautasBuffer.toString('base64')}`;

    console.log('Replacing URLs...');
    // Replace Tortas
    if (htmlContent.includes(tortasUrl)) {
        htmlContent = htmlContent.replace(tortasUrl, tortasBase64);
        console.log('Replaced Tortas URL.');
    } else {
        console.warn('WARNING: Tortas URL not found in HTML.');
    }

    // Replace Flautas
    if (htmlContent.includes(flautasUrl)) {
        htmlContent = htmlContent.replace(flautasUrl, flautasBase64);
        console.log('Replaced Flautas URL.');
    } else {
        console.warn('WARNING: Flautas URL not found in HTML.');
    }

    console.log('Writing updated HTML...');
    fs.writeFileSync(targetHtmlPath, htmlContent);
    console.log('Success! Images embedded.');

} catch (err) {
    console.error('Error:', err);
    process.exit(1);
}
