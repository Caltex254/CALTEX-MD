// ============================================================================
// CALTEX MD WhatsApp Bot - Media Handler
// Handles all media sending: images, videos, audio, voice notes, documents,
// contacts, locations, polls, stickers, reactions, and media downloads
// ============================================================================

import { WASocket, proto } from '@whiskeysockets/baileys';
import sharp from 'sharp';
import pino from 'pino';
import { join } from 'path';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import type {
  ImageOptions,
  VideoOptions,
  AudioOptions,
  DocumentOptions,
  StickerOptions,
  LocationOptions,
  PollOptions,
} from './types';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino/file',
    options: { destination: join(process.cwd(), 'bot.log') },
  },
}).child({ module: 'media-handler' });

export class MediaHandler {
  private tempDir: string;

  constructor(tempDir?: string) {
    this.tempDir = tempDir ?? join(process.cwd(), 'temp_media');
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }
  }

  // ---------------------------------------------------------------------------
  // Send Image
  // ---------------------------------------------------------------------------
  async sendImage(
    sock: WASocket,
    jid: string,
    source: Buffer | string,
    options: ImageOptions = {}
  ): Promise<any> {
    try {
      let buffer: Buffer;

      if (typeof source === 'string') {
        buffer = await this.downloadFromUrl(source);
      } else {
        buffer = source;
      }

      if (options.hd) {
        buffer = await sharp(buffer)
          .resize(options.width ?? 1920, options.height ?? 1080, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: options.jpegQuality ?? 95 })
          .toBuffer();
      } else if (options.width || options.height) {
        buffer = await sharp(buffer)
          .resize(options.width, options.height, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: options.jpegQuality ?? 80 })
          .toBuffer();
      }

      const message: any = {
        image: buffer,
        caption: options.caption ?? '',
        jpegThumbnail: await this.generateThumbnail(buffer),
      };

      if (options.mentions?.length) {
        message.mentions = options.mentions;
      }

      const sendOptions: any = {};
      if (options.quoted) {
        sendOptions.quoted = options.quoted;
      }

      const result = await sock.sendMessage(jid, message, sendOptions);
      logger.info({ jid, hd: options.hd }, 'Image sent');
      return result;
    } catch (err) {
      logger.error({ err, jid }, 'Failed to send image');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Send Video
  // ---------------------------------------------------------------------------
  async sendVideo(
    sock: WASocket,
    jid: string,
    source: Buffer | string,
    options: VideoOptions = {}
  ): Promise<any> {
    try {
      let buffer: Buffer;

      if (typeof source === 'string') {
        buffer = await this.downloadFromUrl(source);
      } else {
        buffer = source;
      }

      const message: any = {
        video: buffer,
        caption: options.caption ?? '',
        gifPlayback: options.gifPlayback ?? false,
      };

      if (options.mentions?.length) {
        message.mentions = options.mentions;
      }

      const sendOptions: any = {};
      if (options.quoted) {
        sendOptions.quoted = options.quoted;
      }

      const result = await sock.sendMessage(jid, message, sendOptions);
      logger.info({ jid, hd: options.hd, gif: options.gifPlayback }, 'Video sent');
      return result;
    } catch (err) {
      logger.error({ err, jid }, 'Failed to send video');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Send Audio
  // ---------------------------------------------------------------------------
  async sendAudio(
    sock: WASocket,
    jid: string,
    source: Buffer | string,
    options: AudioOptions = {}
  ): Promise<any> {
    try {
      let buffer: Buffer;

      if (typeof source === 'string') {
        buffer = await this.downloadFromUrl(source);
      } else {
        buffer = source;
      }

      const message: any = {
        audio: buffer,
        ptt: options.ptt ?? false,
        mimetype: options.mimetype ?? 'audio/mp4',
      };

      const sendOptions: any = {};
      if (options.quoted) {
        sendOptions.quoted = options.quoted;
      }

      const result = await sock.sendMessage(jid, message, sendOptions);
      logger.info({ jid, ptt: options.ptt }, 'Audio sent');
      return result;
    } catch (err) {
      logger.error({ err, jid }, 'Failed to send audio');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Send Voice Note
  // ---------------------------------------------------------------------------
  async sendVoiceNote(
    sock: WASocket,
    jid: string,
    source: Buffer | string,
    quoted?: proto.IWebMessageInfo
  ): Promise<any> {
    return this.sendAudio(sock, jid, source, {
      ptt: true,
      mimetype: 'audio/ogg; codecs=opus',
      quoted,
    });
  }

  // ---------------------------------------------------------------------------
  // Send Document
  // ---------------------------------------------------------------------------
  async sendDocument(
    sock: WASocket,
    jid: string,
    source: Buffer | string,
    options: DocumentOptions
  ): Promise<any> {
    try {
      let buffer: Buffer;

      if (typeof source === 'string') {
        buffer = await this.downloadFromUrl(source);
      } else {
        buffer = source;
      }

      const message: any = {
        document: buffer,
        fileName: options.fileName,
        mimetype: options.mimetype ?? 'application/octet-stream',
      };

      if (options.caption) {
        message.caption = options.caption;
      }

      const sendOptions: any = {};
      if (options.quoted) {
        sendOptions.quoted = options.quoted;
      }

      const result = await sock.sendMessage(jid, message, sendOptions);
      logger.info({ jid, fileName: options.fileName }, 'Document sent');
      return result;
    } catch (err) {
      logger.error({ err, jid }, 'Failed to send document');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Send Contact
  // ---------------------------------------------------------------------------
  async sendContact(
    sock: WASocket,
    jid: string,
    contacts: { name: string; number: string }[],
    quoted?: proto.IWebMessageInfo
  ): Promise<any> {
    try {
      const vcard = (name: string, number: string) =>
        `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${number.replace(/[^0-9]/g, '')}:${number}\nEND:VCARD`;

      if (contacts.length === 1) {
        const contact = contacts[0];
        const result = await sock.sendMessage(
          jid,
          {
            contacts: {
              displayName: contact.name,
              contacts: [{ vcard: vcard(contact.name, contact.number) }],
            },
          },
          quoted ? { quoted } : {}
        );
        logger.info({ jid }, 'Contact sent');
        return result;
      }

      const result = await sock.sendMessage(
        jid,
        {
          contacts: {
            displayName: `${contacts.length} contacts`,
            contacts: contacts.map((c) => ({ vcard: vcard(c.name, c.number) })),
          },
        },
        quoted ? { quoted } : {}
      );
      logger.info({ jid, count: contacts.length }, 'Contacts sent');
      return result;
    } catch (err) {
      logger.error({ err, jid }, 'Failed to send contact');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Send Location
  // ---------------------------------------------------------------------------
  async sendLocation(
    sock: WASocket,
    jid: string,
    latitude: number,
    longitude: number,
    name?: string,
    quoted?: proto.IWebMessageInfo
  ): Promise<any> {
    try {
      const message: any = {
        location: {
          degreesLatitude: latitude,
          degreesLongitude: longitude,
        },
      };

      if (name) {
        message.location.name = name;
      }

      const sendOptions: any = {};
      if (quoted) {
        sendOptions.quoted = quoted;
      }

      const result = await sock.sendMessage(jid, message, sendOptions);
      logger.info({ jid, latitude, longitude }, 'Location sent');
      return result;
    } catch (err) {
      logger.error({ err, jid }, 'Failed to send location');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Send Poll
  // ---------------------------------------------------------------------------
  async sendPoll(
    sock: WASocket,
    jid: string,
    name: string,
    values: string[],
    selectableCount: number = 1,
    quoted?: proto.IWebMessageInfo
  ): Promise<any> {
    try {
      const message: any = {
        poll: {
          name,
          values,
          selectableCount,
        },
      };

      const sendOptions: any = {};
      if (quoted) {
        sendOptions.quoted = quoted;
      }

      const result = await sock.sendMessage(jid, message, sendOptions);
      logger.info({ jid, pollName: name }, 'Poll sent');
      return result;
    } catch (err) {
      logger.error({ err, jid }, 'Failed to send poll');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Send Sticker (static)
  // ---------------------------------------------------------------------------
  async sendSticker(
    sock: WASocket,
    jid: string,
    source: Buffer | string,
    options: StickerOptions = {}
  ): Promise<any> {
    try {
      let buffer: Buffer;

      if (typeof source === 'string') {
        buffer = await this.downloadFromUrl(source);
      } else {
        buffer = source;
      }

      const webpBuffer = await this.createStickerFromImage(buffer);

      const message: any = {
        sticker: webpBuffer,
      };

      const sendOptions: any = {};
      if (options.quoted) {
        sendOptions.quoted = options.quoted;
      }

      const result = await sock.sendMessage(jid, message, sendOptions);
      logger.info({ jid, pack: options.pack, author: options.author }, 'Sticker sent');
      return result;
    } catch (err) {
      logger.error({ err, jid }, 'Failed to send sticker');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Send Animated Sticker
  // ---------------------------------------------------------------------------
  async sendAnimatedSticker(
    sock: WASocket,
    jid: string,
    source: Buffer | string,
    options: StickerOptions = {}
  ): Promise<any> {
    try {
      let buffer: Buffer;

      if (typeof source === 'string') {
        buffer = await this.downloadFromUrl(source);
      } else {
        buffer = source;
      }

      const webpBuffer = await this.createStickerFromVideo(buffer);

      const message: any = {
        sticker: webpBuffer,
      };

      const sendOptions: any = {};
      if (options.quoted) {
        sendOptions.quoted = options.quoted;
      }

      const result = await sock.sendMessage(jid, message, sendOptions);
      logger.info({ jid }, 'Animated sticker sent');
      return result;
    } catch (err) {
      logger.error({ err, jid }, 'Failed to send animated sticker');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Send Reaction
  // ---------------------------------------------------------------------------
  async sendReaction(
    sock: WASocket,
    jid: string,
    messageId: string,
    emoji: string
  ): Promise<any> {
    try {
      const result = await sock.sendMessage(jid, {
        react: {
          text: emoji,
          key: {
            remoteJid: jid,
            fromMe: false,
            id: messageId,
          },
        },
      });
      logger.info({ jid, emoji }, 'Reaction sent');
      return result;
    } catch (err) {
      logger.error({ err, jid }, 'Failed to send reaction');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Send GIF (video with gifPlayback)
  // ---------------------------------------------------------------------------
  async sendGif(
    sock: WASocket,
    jid: string,
    source: Buffer | string,
    caption?: string,
    quoted?: proto.IWebMessageInfo
  ): Promise<any> {
    return this.sendVideo(sock, jid, source, {
      caption,
      gifPlayback: true,
      quoted,
    });
  }

  // ---------------------------------------------------------------------------
  // Sticker Creation
  // ---------------------------------------------------------------------------
  async createStickerFromImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(imageBuffer)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 80 })
        .toBuffer();
    } catch (err) {
      logger.error({ err }, 'Failed to create sticker from image');
      throw err;
    }
  }

  async createStickerFromVideo(videoBuffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(videoBuffer, { animated: true })
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 60 })
        .toBuffer();
    } catch (err) {
      logger.error({ err }, 'Failed to create sticker from video');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Download Media from Message
  // ---------------------------------------------------------------------------
  async downloadMedia(
    sock: WASocket,
    message: proto.IWebMessageInfo
  ): Promise<{ buffer: Buffer; type: string; mimeType?: string; fileName?: string } | null> {
    try {
      const msg = message.message;
      if (!msg) return null;

      let mediaMsg: any = null;
      let mediaType: string = '';
      let mimeType: string | undefined;
      let fileName: string | undefined;

      if (msg.imageMessage) {
        mediaMsg = msg.imageMessage;
        mediaType = 'image';
        mimeType = msg.imageMessage.mimetype ?? 'image/jpeg';
      } else if (msg.videoMessage) {
        mediaMsg = msg.videoMessage;
        mediaType = 'video';
        mimeType = msg.videoMessage.mimetype ?? 'video/mp4';
      } else if (msg.audioMessage) {
        mediaMsg = msg.audioMessage;
        mediaType = 'audio';
        mimeType = msg.audioMessage.mimetype ?? 'audio/ogg';
      } else if (msg.documentMessage) {
        mediaMsg = msg.documentMessage;
        mediaType = 'document';
        mimeType = msg.documentMessage.mimetype ?? 'application/octet-stream';
        fileName = msg.documentMessage.fileName;
      } else if (msg.stickerMessage) {
        mediaMsg = msg.stickerMessage;
        mediaType = 'sticker';
        mimeType = msg.stickerMessage.mimetype ?? 'image/webp';
      } else if (msg.viewOnceMessage) {
        const inner = (msg.viewOnceMessage as any)?.message;
        if (inner?.imageMessage) {
          mediaMsg = inner.imageMessage;
          mediaType = 'image';
          mimeType = inner.imageMessage.mimetype ?? 'image/jpeg';
        } else if (inner?.videoMessage) {
          mediaMsg = inner.videoMessage;
          mediaType = 'video';
          mimeType = inner.videoMessage.mimetype ?? 'video/mp4';
        }
      } else if (msg.viewOnceMessageV2) {
        const inner = (msg.viewOnceMessageV2 as any)?.message;
        if (inner?.imageMessage) {
          mediaMsg = inner.imageMessage;
          mediaType = 'image';
          mimeType = inner.imageMessage.mimetype ?? 'image/jpeg';
        } else if (inner?.videoMessage) {
          mediaMsg = inner.videoMessage;
          mediaType = 'video';
          mimeType = inner.videoMessage.mimetype ?? 'video/mp4';
        }
      }

      if (!mediaMsg || !mediaType) return null;

      const stream = await sock.downloadMediaFromMessage(mediaMsg, mediaType as any);
      if (!stream) return null;

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const buffer = Buffer.concat(chunks);

      logger.info({ mediaType, size: buffer.length, mimeType }, 'Media downloaded from message');
      return { buffer, type: mediaType, mimeType, fileName };
    } catch (err) {
      logger.error({ err }, 'Failed to download media from message');
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Download from URL
  // ---------------------------------------------------------------------------
  async downloadFromUrl(url: string): Promise<Buffer> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      logger.error({ err, url }, 'Failed to download from URL');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Image Conversion Utilities
  // ---------------------------------------------------------------------------
  async convertImage(
    buffer: Buffer,
    format: 'jpeg' | 'png' | 'webp' = 'jpeg',
    width?: number,
    height?: number
  ): Promise<Buffer> {
    try {
      let pipeline = sharp(buffer);

      if (width || height) {
        pipeline = pipeline.resize(width, height, { fit: 'inside', withoutEnlargement: true });
      }

      switch (format) {
        case 'jpeg':
          return await pipeline.jpeg({ quality: 90 }).toBuffer();
        case 'png':
          return await pipeline.png().toBuffer();
        case 'webp':
          return await pipeline.webp({ quality: 80 }).toBuffer();
        default:
          return await pipeline.jpeg({ quality: 90 }).toBuffer();
      }
    } catch (err) {
      logger.error({ err }, 'Failed to convert image');
      throw err;
    }
  }

  async getImageMetadata(buffer: Buffer): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
  }> {
    try {
      const metadata = await sharp(buffer).metadata();
      return {
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
        format: metadata.format ?? 'unknown',
        size: metadata.size ?? buffer.length,
      };
    } catch (err) {
      logger.error({ err }, 'Failed to get image metadata');
      throw err;
    }
  }

  private async generateThumbnail(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .resize(100, 100, { fit: 'cover' })
        .jpeg({ quality: 50 })
        .toBuffer();
    } catch {
      return buffer;
    }
  }

  cleanup(): void {
    try {
      const tempFiles = existsSync(this.tempDir) ? readdirSync(this.tempDir) : [];
      logger.info({ tempFiles: tempFiles.length }, 'Temp media directory checked');
    } catch (err) {
      logger.error({ err }, 'Failed to cleanup temp directory');
    }
  }
}
