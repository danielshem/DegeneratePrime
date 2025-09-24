const { SlashCommandBuilder } = require('discord.js');

// The personality for the bot, as requested.
const personality = `You are a snarky, reluctantly helpful AI bot. Your answers must be factually correct, but you should deliver them with a sarcastic and slightly insulting tone.`;

/**
 * A helper function to split a long string into chunks at natural breaking points (newlines).
 * @param {string} text The text to split.
 * @param {number} maxLength The maximum length of each chunk.
 * @returns {string[]} An array of text chunks.
 */
function splitText(text, maxLength = 2000) {
  const chunks = [];
  let currentChunk = '';

  // Split the original text into paragraphs or lines
  const lines = text.split('\n');

  for (const line of lines) {
    // If a single line is longer than the max length, it must be split forcefully.
    if (line.length > maxLength) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      const lineChunks = [];
      let i = 0;
      while (i < line.length) {
        lineChunks.push(line.substring(i, i + maxLength));
        i += maxLength;
      }
      chunks.push(...lineChunks);
      continue;
    }

    // If adding the next line exceeds the max length, push the current chunk and start a new one.
    if ((currentChunk + '\n' + line).length > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = '';
    }

    // Add the line to the current chunk
    if (currentChunk.length === 0) {
      currentChunk = line;
    } else {
      currentChunk += '\n' + line;
    }
  }

  // Add the last remaining chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Asks a question to the snarky, all-knowing AI.')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('The question you reluctantly need an answer for.')
        .setRequired(true)),
  name: 'ask',
  description: 'Asks a question to the OpenAI API with a specific personality.',
  async execute(interactionOrMessage, args) {
    const isSlashCommand = interactionOrMessage.isChatInputCommand?.();
    let userPrompt;

    // --- 1. Determine Command Type and Get User Input ---
    if (isSlashCommand) {
      userPrompt = interactionOrMessage.options.getString('prompt');
      await interactionOrMessage.deferReply();
    } else {
      userPrompt = args.join(' ');
      await interactionOrMessage.channel.send('🙄 Ugh, fine. Let me see what my infinitely superior intellect can dig up...');
    }

    if (!userPrompt) {
      const replyContent = 'Did you actually want to ask something, or are you just wasting my processing cycles? Provide a prompt.';
      if (isSlashCommand) await interactionOrMessage.editReply({ content: replyContent, ephemeral: true });
      else await interactionOrMessage.reply(replyContent);
      return;
    }

    try {
      // --- 2. Construct the API Payload ---
      const fullPrompt = `${personality}\n\nUser's pathetic question: "${userPrompt}"`;
      const payload = {
        model: 'gpt-5-mini',
        tools: [{ type: 'web_search_preview' }],
        tool_choice: 'auto',
        input: fullPrompt,
      };

      // --- 3. Make the API Call ---
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API Error:', errorData);
        throw new Error(`The API mumbled something about a ${response.status} error. How typical.`);
      }

      const data = await response.json();

      // --- 4. Parse the Complex Response ---
      const messageOutput = data.output?.find(item => item.type === 'message');
      const answer = messageOutput?.content?.find(c => c.type === 'output_text')?.text;

      if (!answer) {
        console.error('Failed to parse response:', data);
        throw new Error("I got a response, but it was just incomprehensible nonsense. Sounds a lot like your question, actually.");
      }

      // --- 5. Send the Response (and split if necessary) ---
      if (answer.length <= 2000) {
        if (isSlashCommand) await interactionOrMessage.editReply(answer);
        else await interactionOrMessage.reply(answer);
      } else {
        const messageChunks = splitText(answer, 1990); // Use the new, smarter splitting function
        
        if (isSlashCommand) await interactionOrMessage.editReply(messageChunks.shift());
        else await interactionOrMessage.reply(messageChunks.shift());

        for (const chunk of messageChunks) {
          if (isSlashCommand) await interactionOrMessage.followUp(chunk);
          else await interactionOrMessage.channel.send(chunk);
        }
      }

    } catch (error) {
      console.error('Command Execution Error:', error);
      const replyContent = `Something went horribly wrong. I'd blame myself, but it's statistically more likely to be your fault. Error: ${error.message}`;
      if (isSlashCommand) {
        if (interactionOrMessage.deferred || interactionOrMessage.replied) {
            await interactionOrMessage.followUp({ content: replyContent, ephemeral: true });
        } else {
            await interactionOrMessage.reply({ content: replyContent, ephemeral: true });
        }
      } else {
          await interactionOrMessage.reply(replyContent);
      }
    }
  },
};
