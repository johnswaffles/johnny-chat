// index.js  — tiny CLI chatbot
require('dotenv').config();              // <- loads .env

const OpenAI = require('openai');
const readline = require('readline');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY     // now available
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  while (true) {
    const prompt = await new Promise(res => rl.question('You: ', res));
    if (/^(exit|quit)$/i.test(prompt.trim())) break;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }]
    });

    console.log('\nAI:', response.choices[0].message.content.trim(), '\n');
  }
  rl.close();
}

main();

