// ============================================================================
// CALTEX MD WhatsApp Bot - Group Manager
// All group management operations: promote/demote, add/remove members,
// settings, mute/unmute, profile picture, invite codes, etc.
// ============================================================================

import { WASocket, GroupMetadata } from '@whiskeysockets/baileys';
import pino from 'pino';
import { join } from 'path';
import type { GroupInfo } from './types';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino/file',
    options: { destination: join(process.cwd(), 'bot.log') },
  },
}).child({ module: 'group-manager' });

export class GroupManager {
  private metadataCache: Map<string, { data: GroupMetadata; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes

  // ---------------------------------------------------------------------------
  // Promote / Demote
  // ---------------------------------------------------------------------------
  async promoteAdmin(sock: WASocket, groupJid: string, userJid: string): Promise<void> {
    try {
      await sock.groupParticipantsUpdate(groupJid, [userJid], 'promote');
      this.invalidateCache(groupJid);
      logger.info({ groupJid, userJid }, 'User promoted to admin');
    } catch (err) {
      logger.error({ err, groupJid, userJid }, 'Failed to promote user');
      throw err;
    }
  }

  async demoteAdmin(sock: WASocket, groupJid: string, userJid: string): Promise<void> {
    try {
      await sock.groupParticipantsUpdate(groupJid, [userJid], 'demote');
      this.invalidateCache(groupJid);
      logger.info({ groupJid, userJid }, 'User demoted from admin');
    } catch (err) {
      logger.error({ err, groupJid, userJid }, 'Failed to demote user');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Add / Remove Members
  // ---------------------------------------------------------------------------
  async addMembers(sock: WASocket, groupJid: string, userJids: string[]): Promise<any> {
    try {
      const result = await sock.groupParticipantsUpdate(groupJid, userJids, 'add');
      logger.info({ groupJid, count: userJids.length }, 'Members added to group');
      return result;
    } catch (err) {
      logger.error({ err, groupJid }, 'Failed to add members');
      throw err;
    }
  }

  async removeMembers(sock: WASocket, groupJid: string, userJids: string[]): Promise<void> {
    try {
      await sock.groupParticipantsUpdate(groupJid, userJids, 'remove');
      logger.info({ groupJid, count: userJids.length }, 'Members removed from group');
    } catch (err) {
      logger.error({ err, groupJid }, 'Failed to remove members');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Group Settings
  // ---------------------------------------------------------------------------
  async setGroupName(sock: WASocket, groupJid: string, name: string): Promise<void> {
    try {
      await sock.groupUpdateSubject(groupJid, name);
      this.invalidateCache(groupJid);
      logger.info({ groupJid, name }, 'Group name updated');
    } catch (err) {
      logger.error({ err, groupJid, name }, 'Failed to update group name');
      throw err;
    }
  }

  async setGroupDescription(sock: WASocket, groupJid: string, description: string): Promise<void> {
    try {
      await sock.groupUpdateDescription(groupJid, description);
      this.invalidateCache(groupJid);
      logger.info({ groupJid }, 'Group description updated');
    } catch (err) {
      logger.error({ err, groupJid }, 'Failed to update group description');
      throw err;
    }
  }

  async setGroupProfilePic(sock: WASocket, groupJid: string, buffer: Buffer): Promise<void> {
    try {
      await sock.updateProfilePicture(groupJid, buffer);
      logger.info({ groupJid }, 'Group profile picture updated');
    } catch (err) {
      logger.error({ err, groupJid }, 'Failed to update group profile picture');
      throw err;
    }
  }

  async lockGroupSettings(sock: WASocket, groupJid: string): Promise<void> {
    try {
      await sock.groupSettingUpdate(groupJid, 'locked');
      this.invalidateCache(groupJid);
      logger.info({ groupJid }, 'Group settings locked');
    } catch (err) {
      logger.error({ err, groupJid }, 'Failed to lock group settings');
      throw err;
    }
  }

  async unlockGroupSettings(sock: WASocket, groupJid: string): Promise<void> {
    try {
      await sock.groupSettingUpdate(groupJid, 'unlocked');
      this.invalidateCache(groupJid);
      logger.info({ groupJid }, 'Group settings unlocked');
    } catch (err) {
      logger.error({ err, groupJid }, 'Failed to unlock group settings');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Mute / Unmute
  // ---------------------------------------------------------------------------
  async muteGroup(sock: WASocket, groupJid: string, duration?: number): Promise<void> {
    try {
      if (duration) {
        await sock.groupSettingUpdate(groupJid, 'announcement');
        setTimeout(async () => {
          try {
            await sock.groupSettingUpdate(groupJid, 'not_announcement');
            logger.info({ groupJid }, 'Group unmuted after duration');
          } catch (err) {
            logger.error({ err, groupJid }, 'Failed to auto-unmute group');
          }
        }, duration);
        logger.info({ groupJid, duration }, 'Group muted temporarily');
      } else {
        await sock.groupSettingUpdate(groupJid, 'announcement');
        logger.info({ groupJid }, 'Group muted (only admins can send messages)');
      }
      this.invalidateCache(groupJid);
    } catch (err) {
      logger.error({ err, groupJid }, 'Failed to mute group');
      throw err;
    }
  }

  async unmuteGroup(sock: WASocket, groupJid: string): Promise<void> {
    try {
      await sock.groupSettingUpdate(groupJid, 'not_announcement');
      this.invalidateCache(groupJid);
      logger.info({ groupJid }, 'Group unmuted');
    } catch (err) {
      logger.error({ err, groupJid }, 'Failed to unmute group');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Group Info & Metadata
  // ---------------------------------------------------------------------------
  async getGroupInfo(sock: WASocket, groupJid: string): Promise<GroupInfo | null> {
    try {
      const metadata = await this.getGroupMetadata(sock, groupJid);
      if (!metadata) return null;

      return {
        id: metadata.id,
        subject: metadata.subject,
        desc: metadata.desc ?? undefined,
        owner: metadata.owner ?? undefined,
        creation: metadata.creation ?? undefined,
        participants: metadata.participants?.map((p) => ({
          id: p.id,
          admin: p.admin ?? undefined,
        })) ?? [],
        restrict: metadata.restrict ?? undefined,
        announce: metadata.announce ?? undefined,
        size: metadata.participants?.length ?? 0,
      };
    } catch (err) {
      logger.error({ err, groupJid }, 'Failed to get group info');
      return null;
    }
  }

  async getGroupMetadata(sock: WASocket, groupJid: string): Promise<GroupMetadata | null> {
    const cached = this.metadataCache.get(groupJid);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const metadata = await sock.groupMetadata(groupJid);
      this.metadataCache.set(groupJid, { data: metadata, timestamp: Date.now() });
      return metadata;
    } catch (err) {
      logger.error({ err, groupJid }, 'Failed to get group metadata');
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Leave Group
  // ---------------------------------------------------------------------------
  async leaveGroup(sock: WASocket, groupJid: string): Promise<void> {
    try {
      await sock.groupLeave(groupJid);
      this.invalidateCache(groupJid);
      logger.info({ groupJid }, 'Left group');
    } catch (err) {
      logger.error({ err, groupJid }, 'Failed to leave group');
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Invite Code Management
  // ---------------------------------------------------------------------------
  async getInviteCode(sock: WASocket, groupJid: string): Promise<string | null> {
    try {
      const code = await sock.groupInviteCode(groupJid);
      logger.info({ groupJid }, 'Invite code retrieved');
      return code;
    } catch (err) {
      logger.error({ err, groupJid }, 'Failed to get invite code');
      return null;
    }
  }

  async revokeInviteCode(sock: WASocket, groupJid: string): Promise<string | null> {
    try {
      const code = await sock.groupRevokeInvite(groupJid);
      logger.info({ groupJid }, 'Invite code revoked');
      return code;
    } catch (err) {
      logger.error({ err, groupJid }, 'Failed to revoke invite code');
      return null;
    }
  }

  async acceptInvite(sock: WASocket, inviteCode: string): Promise<string | null> {
    try {
      const groupId = await sock.groupAcceptInvite(inviteCode);
      logger.info({ inviteCode, groupId }, 'Accepted group invite');
      return groupId;
    } catch (err) {
      logger.error({ err, inviteCode }, 'Failed to accept group invite');
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Fetch All Groups
  // ---------------------------------------------------------------------------
  async getGroups(sock: WASocket): Promise<{ id: string; subject: string; size: number }[]> {
    try {
      const groups = await sock.groupFetchAllParticipating();
      const groupList = Object.entries(groups).map(([id, metadata]) => ({
        id,
        subject: metadata.subject,
        size: metadata.participants?.length ?? 0,
      }));

      logger.info({ count: groupList.length }, 'Fetched all groups');
      return groupList;
    } catch (err) {
      logger.error({ err }, 'Failed to fetch groups');
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Admin Checks
  // ---------------------------------------------------------------------------
  async isMemberAdmin(sock: WASocket, groupJid: string, participantId: string): Promise<boolean> {
    try {
      const metadata = await this.getGroupMetadata(sock, groupJid);
      if (!metadata) return false;

      const participant = metadata.participants?.find((p) => p.id === participantId);
      return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch (err) {
      logger.error({ err, groupJid, participantId }, 'Failed to check admin status');
      return false;
    }
  }

  async isBotAdmin(sock: WASocket, groupJid: string): Promise<boolean> {
    try {
      const botJid = sock.user?.id;
      if (!botJid) return false;

      const metadata = await this.getGroupMetadata(sock, groupJid);
      if (!metadata) return false;

      const botId = botJid.replace(/:.*@/, '@');
      const participant = metadata.participants?.find(
        (p) => p.id === botId || p.id?.split('@')[0] === botJid.split(':')[0]
      );
      return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch (err) {
      logger.error({ err, groupJid }, 'Failed to check bot admin status');
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Cache Management
  // ---------------------------------------------------------------------------
  private invalidateCache(groupJid: string): void {
    this.metadataCache.delete(groupJid);
  }

  clearCache(): void {
    this.metadataCache.clear();
  }
}
