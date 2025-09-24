const { OpenAI } = require('openai');
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = {
  data: new SlashCommandBuilder()
    .setName('imageg') // temporary update to imageg while testing this alongside another bot
    .setDescription('Generates an image using DALL-E 3.')
    .addStringOption(option =>
      option.setName('prompt')
        .setDescription('A description of the image you want to generate.')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('quality')
        .setDescription('The quality of the image. Defaults to standard.')
        .addChoices(
          { name: 'Standard', value: 'standard' },
          { name: 'HD', value: 'hd' },
        ))
    .addStringOption(option =>
      option.setName('style')
        .setDescription('The style of the image. Defaults to vivid.')
        .addChoices(
          { name: 'Vivid', value: 'vivid' },
          { name: 'Natural', value: 'natural' },
        )),
  name: 'image',
  description: 'Generates an image using DALL-E 3.',
  async execute(interactionOrMessage, args) {
    let prompt;
    let quality = 'standard'; // Default quality
    let style = 'vivid';      // Default style
    let replyFunction;
    const isSlashCommand = interactionOrMessage.isChatInputCommand?.();

    if (isSlashCommand) {
      prompt = interactionOrMessage.options.getString('prompt');
      // Get the quality and style if the user provided them, otherwise use defaults
      quality = interactionOrMessage.options.getString('quality') ?? 'standard';
      style = interactionOrMessage.options.getString('style') ?? 'vivid';
      replyFunction = (options) => interactionOrMessage.editReply(options);
      await interactionOrMessage.deferReply();
    } else {
      prompt = args.join(' ');
      replyFunction = (options) => interactionOrMessage.reply(options);
      await interactionOrMessage.channel.send('🎨 Generating your image...');
    }

    if (!prompt) {
      const replyContent = 'Please provide a description for the image.';
      if (isSlashCommand) await interactionOrMessage.editReply({ content: replyContent, ephemeral: true });
      else await replyFunction({ content: replyContent });
      return;
    }

    try {
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        quality: quality, // Use the selected or default quality
        style: style,     // Use the selected or default style
        size: '1024x1024',
      });

      const imageUrl = response.data[0].url;
      const attachment = new AttachmentBuilder(imageUrl, { name: 'dalle-image.png' });
      
      await replyFunction({
        files: [attachment],
      });

    } catch (error) {
      console.error('DALL-E Error:', error);
      const replyContent = 'Sorry, I couldn\'t generate that image. The prompt might have been rejected by the safety filters.';
      if (isSlashCommand) await interactionOrMessage.editReply({ content: replyContent });
      else await replyFunction({ content: replyContent });
    }
  },
};
