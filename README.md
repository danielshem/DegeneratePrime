# OptimusDegenerate
discord bot

## Configuration

The bot uses a `config.json` file to configure OpenAI model settings. You can modify this file to change which models are used for different commands:

```json
{
  "openai": {
    "models": {
      "chat": "gpt-4o",
      "image": "dall-e-3"
    }
  }
}
```

- `chat`: Model used for the `/ask` command
- `image`: Model used for the `/image` command
