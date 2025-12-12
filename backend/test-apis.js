// Quick API test script
require("dotenv").config();
const OpenAI = require("openai");
const axios = require("axios");

async function testAPIs() {
  console.log("🧪 Testing API Configuration...\n");

  // Check OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  console.log("📋 OpenAI API Key:");
  console.log(`   Exists: ${!!openaiKey}`);
  console.log(`   Length: ${openaiKey ? openaiKey.length : 0}`);
  console.log(`   Starts with: ${openaiKey ? openaiKey.substring(0, 10) + '...' : 'N/A'}`);

  if (openaiKey && openaiKey.trim()) {
    console.log("\n🔄 Testing OpenAI API...");
    try {
      const openai = new OpenAI({ apiKey: openaiKey.trim() });
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Say 'OpenAI test successful' if you can read this." }],
        max_tokens: 20
      });
      console.log("✅ OpenAI API Test: SUCCESS");
      console.log(`   Response: ${response.choices[0].message.content}`);
    } catch (error) {
      console.log("❌ OpenAI API Test: FAILED");
      console.log(`   Error: ${error.message}`);
      if (error.status) console.log(`   Status: ${error.status}`);
      if (error.code) console.log(`   Code: ${error.code}`);
    }
  } else {
    console.log("⚠️  OpenAI API Key not configured");
  }

  // Check Groq
  const groqKey = process.env.GROQ_API_KEY;
  console.log("\n📋 Groq API Key:");
  console.log(`   Exists: ${!!groqKey}`);
  console.log(`   Length: ${groqKey ? groqKey.length : 0}`);
  console.log(`   Starts with: ${groqKey ? groqKey.substring(0, 10) + '...' : 'N/A'}`);

  if (groqKey && groqKey.trim()) {
    console.log("\n🔄 Testing Groq API...");
    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: "user", content: "Say 'Groq test successful' if you can read this." }],
          max_tokens: 20
        },
        {
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      console.log("✅ Groq API Test: SUCCESS");
      console.log(`   Response: ${response.data.choices[0].message.content}`);
    } catch (error) {
      console.log("❌ Groq API Test: FAILED");
      console.log(`   Error: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data: ${JSON.stringify(error.response.data)}`);
      }
    }
  } else {
    console.log("⚠️  Groq API Key not configured");
  }

  console.log("\n✨ Test complete!");
}

testAPIs().catch(console.error);
