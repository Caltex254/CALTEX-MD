// ============================================================================
// CALTEX MD WhatsApp Bot - Fun Commands
// Jokes, quotes, facts, 8ball, dice, coin flip, RPS, trivia, memes
// ============================================================================

import type { Plugin, CommandContext } from '../plugin-loader';

// ---------------------------------------------------------------------------
// Fun Data
// ---------------------------------------------------------------------------

const JOKES: string[] = [
  "Why don't scientists trust atoms? Because they make up everything!",
  "Why did the scarecrow win an award? He was outstanding in his field!",
  "I told my wife she was drawing her eyebrows too high. She looked surprised.",
  "Why don't eggs tell jokes? They'd crack each other up!",
  "What do you call a fake noodle? An impasta!",
  "Why did the math book look so sad? Because it had too many problems.",
  "What do you call a bear with no teeth? A gummy bear!",
  "Why can't a bicycle stand on its own? It's two tired!",
  "I'm reading a book about anti-gravity. It's impossible to put down!",
  "What did the ocean say to the shore? Nothing, it just waved.",
  "Why did the coffee file a police report? It got mugged!",
  "What do you call a dog magician? A Labracadabrador!",
  "How do you organize a space party? You planet!",
  "Why did the tomato turn red? Because it saw the salad dressing!",
  "What do you call a sleeping dinosaur? A dino-snore!",
];

const QUOTES: { text: string; author: string }[] = [
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { text: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
  { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
];

const FACTS: string[] = [
  "Honey never spoils. Archaeologists have found 3000-year-old honey that's still edible!",
  "A group of flamingos is called a 'flamboyance'.",
  "Octopuses have three hearts and blue blood.",
  "Bananas are berries, but strawberries aren't.",
  "A day on Venus is longer than a year on Venus.",
  "The shortest war in history lasted 38 minutes (between Britain and Zanzibar).",
  "Cows have best friends and get stressed when they're separated.",
  "The human brain uses about 20% of the body's total energy.",
  "There are more possible iterations of a chess game than atoms in the observable universe.",
  "Wombat poop is cube-shaped.",
  "A jiffy is an actual unit of time: 1/100th of a second.",
  "The inventor of the Pringles can is buried in one.",
  "A blue whale's heart is so big that a small child could swim through its arteries.",
  "There are more stars in the universe than grains of sand on all the Earth's beaches.",
  "The first computer bug was an actual bug — a moth found in a Harvard computer in 1947.",
];

const EIGHT_BALL_RESPONSES: string[] = [
  "It is certain ✅",
  "Without a doubt ✅",
  "Yes, definitely ✅",
  "Reply hazy, try again 🔮",
  "Ask again later 🔮",
  "Cannot predict now 🔮",
  "Don't count on it ❌",
  "My reply is no ❌",
  "Very doubtful ❌",
  "Most likely ✅",
  "Outlook good ✅",
  "Signs point to yes ✅",
  "Better not tell you now 🔮",
  "Concentrate and ask again 🔮",
  "My sources say no ❌",
  "Outlook not so good ❌",
];

const TRIVIA: { question: string; options: string[]; answer: number }[] = [
  { question: "What planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], answer: 1 },
  { question: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Pacific", "Arctic"], answer: 2 },
  { question: "How many continents are there?", options: ["5", "6", "7", "8"], answer: 2 },
  { question: "What is the chemical symbol for gold?", options: ["Go", "Gd", "Au", "Ag"], answer: 2 },
  { question: "Which country has the most people?", options: ["USA", "India", "China", "Indonesia"], answer: 1 },
  { question: "What year did World War II end?", options: ["1943", "1944", "1945", "1946"], answer: 2 },
  { question: "What is the speed of light (approx)?", options: ["300,000 km/s", "150,000 km/s", "500,000 km/s", "1,000,000 km/s"], answer: 0 },
  { question: "Who painted the Mona Lisa?", options: ["Michelangelo", "Da Vinci", "Raphael", "Picasso"], answer: 1 },
];

const RPS_CHOICES = ['rock 🪨', 'paper 📄', 'scissors ✂️'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const funPlugin: Plugin = {
  name: 'fun',
  version: '1.0.0',
  description: 'Fun and entertainment commands: jokes, quotes, games, and more',
  author: 'CALTEX MD',
  enabled: true,
  commands: [
    {
      name: 'joke',
      description: 'Get a random joke',
      category: 'fun',
      aliases: ['jokes', 'dadjoke'],
      cooldown: 3,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('😂');
        await ctx.reply(`😂 ${pick(JOKES)}`);
      },
    },
    {
      name: 'quote',
      description: 'Get an inspirational quote',
      category: 'fun',
      aliases: ['quotes', 'inspire'],
      cooldown: 3,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const q = pick(QUOTES);
        await ctx.react('💭');
        await ctx.reply(`💭 "${q.text}"\n\n— *${q.author}*`);
      },
    },
    {
      name: 'fact',
      description: 'Get a random fun fact',
      category: 'fun',
      aliases: ['facts', 'funfact'],
      cooldown: 3,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('🧠');
        await ctx.reply(`🧠 *Fun Fact:*\n\n${pick(FACTS)}`);
      },
    },
    {
      name: '8ball',
      description: 'Ask the Magic 8-Ball a question',
      category: 'fun',
      aliases: ['eightball', 'magic8', 'ask8'],
      cooldown: 3,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const question = ctx.args.join(' ');
        if (!question) {
          await ctx.reply('❌ Usage: .8ball <question>\nExample: .8ball Will I be rich?');
          return;
        }
        await ctx.react('🔮');
        const response = pick(EIGHT_BALL_RESPONSES);
        await ctx.reply(`🔮 *Magic 8-Ball*\n\n❓ ${question}\n🎱 ${response}`);
      },
    },
    {
      name: 'roll',
      description: 'Roll a dice (1-6) or specify sides',
      category: 'fun',
      aliases: ['dice', 'rolldice'],
      cooldown: 3,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const sides = parseInt(ctx.args[0]) || 6;
        if (sides < 2 || sides > 100) {
          await ctx.reply('❌ Sides must be between 2 and 100.');
          return;
        }
        const result = Math.floor(Math.random() * sides) + 1;
        await ctx.react('🎲');
        await ctx.reply(`🎲 *Dice Roll (d${sides})*\n\nResult: *${result}*`);
      },
    },
    {
      name: 'flip',
      description: 'Flip a coin',
      category: 'fun',
      aliases: ['coin', 'coinflip'],
      cooldown: 3,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const result = Math.random() < 0.5 ? 'Heads 👑' : 'Tails 🪙';
        await ctx.react('🪙');
        await ctx.reply(`🪙 *Coin Flip*\n\nResult: *${result}*`);
      },
    },
    {
      name: 'rps',
      description: 'Play Rock Paper Scissors against the bot',
      category: 'fun',
      aliases: ['rockpaperscissors'],
      cooldown: 3,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const choice = ctx.args[0]?.toLowerCase();
        if (!choice || !['rock', 'paper', 'scissors', 'r', 'p', 's'].includes(choice)) {
          await ctx.reply('❌ Usage: .rps <rock|paper|scissors>\nExample: .rps rock');
          return;
        }
        const playerChoice = choice[0] === 'r' ? 0 : choice[0] === 'p' ? 1 : 2;
        const botChoice = Math.floor(Math.random() * 3);
        const botPick = RPS_CHOICES[botChoice];
        const playerPick = RPS_CHOICES[playerChoice];

        let result: string;
        if (playerChoice === botChoice) {
          result = "🤝 It's a tie!";
        } else if (
          (playerChoice === 0 && botChoice === 2) ||
          (playerChoice === 1 && botChoice === 0) ||
          (playerChoice === 2 && botChoice === 1)
        ) {
          result = '🎉 You win!';
        } else {
          result = '😢 I win!';
        }

        await ctx.react('✊');
        await ctx.reply(`✊ *Rock Paper Scissors*\n\nYou: ${playerPick}\nBot: ${botPick}\n\n${result}`);
      },
    },
    {
      name: 'trivia',
      description: 'Get a random trivia question',
      category: 'fun',
      aliases: ['quiz', 'question'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        const t = pick(TRIVIA);
        let text = `🧠 *Trivia Time!*\n\n❓ ${t.question}\n\n`;
        for (let i = 0; i < t.options.length; i++) {
          text += `${String.fromCharCode(65 + i)}. ${t.options[i]}\n`;
        }
        text += `\n_Reply with the letter (A, B, C, D) to answer! Answer: ${String.fromCharCode(65 + t.answer)}_`;
        await ctx.react('🧠');
        await ctx.reply(text);
      },
    },
    {
      name: 'meme',
      description: 'Get a random meme',
      category: 'fun',
      aliases: ['memes', 'funny'],
      cooldown: 5,
      isPremiumOnly: false,
      handler: async (ctx: CommandContext) => {
        await ctx.react('🤣');
        await ctx.reply(
          '🤣 *Random Meme*\n\n_In production, this fetches a random meme from a meme API (e.g., meme-api.com) and sends the image._'
        );
      },
    },
  ],
};

export default funPlugin;
