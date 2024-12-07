import { AeadId, CipherSuite, KdfId, KemId } from "hpke-js";

/**
 * Utility to generate a key pair using the HPKE CipherSuite.
 */
async function generateKeyPair() {
  const suite = new CipherSuite({
    kem: KemId.DhkemX25519HkdfSha256,
    kdf: KdfId.HkdfSha256,
    aead: AeadId.Chacha20Poly1305,
  });
  const keyPair = await suite.kem.generateKeyPair();
  return keyPair;
}

/**
 * Serialize a key to ArrayBuffer.
 */
async function exportKey(key) {
  return key; // HPKE keys are already in the correct format
}

/**
 * MLS Library for Secure Messaging
 */
class MLS {
  constructor() {
    this.groups = {}; // Store groups with their secrets, members, and message history
  }

  async createGroup(groupId, members) {
    const groupSecret = await this.generateGroupSecret();
    this.groups[groupId] = {
      secret: groupSecret,
      epoch: 0,
      members,
      messageHistory: [],
    };
    console.log(`Group '${groupId}' created with members: ${members}`);
  }

  async addMember(groupId, newMember) {
    const group = this.groups[groupId];
    if (!group) throw new Error(`Group '${groupId}' does not exist.`);

    group.members.push(newMember);
    await this.updateEpoch(groupId);
    console.log(`Member '${newMember}' added to group '${groupId}'.`);
  }

  async removeMember(groupId, removedUser) {
    const group = this.groups[groupId];
    if (!group) throw new Error(`Group '${groupId}' does not exist.`);

    group.members = group.members.filter((member) => member !== removedUser);
    if (group.members.length === 0) {
      throw new Error(`Cannot remove the last member of the group.`);
    }

    await this.updateEpoch(groupId);
    console.log(`Member '${removedUser}' removed from group '${groupId}'.`);
  }

  async sendMessage(groupId, sender, message) {
    const group = this.groups[groupId];
    if (!group) throw new Error(`Group '${groupId}' does not exist.`);

    const suite = new CipherSuite({
      kem: KemId.DhkemX25519HkdfSha256,
      kdf: KdfId.HkdfSha256,
      aead: AeadId.Chacha20Poly1305,
    });

    const senderContext = await suite.createSenderContext({
      recipientPublicKey: group.secret.publicKey,
    });

    const ciphertext = await senderContext.seal(
      new TextEncoder().encode(message)
    );

    // Store both ciphertext and encapsulation key (enc) in message history
    group.messageHistory.push({
      sender,
      ciphertext,
      enc: senderContext.enc, // Include the encapsulation key
    });

    console.log(`Message sent by '${sender}' in group '${groupId}'.`);
    return { ciphertext, enc: senderContext.enc }; // Return enc with ciphertext
  }

  async receiveMessage(groupId, recipient, ciphertext, enc) {
    const group = this.groups[groupId];
    if (!group) throw new Error(`Group '${groupId}' does not exist.`);

    const suite = new CipherSuite({
      kem: KemId.DhkemX25519HkdfSha256,
      kdf: KdfId.HkdfSha256,
      aead: AeadId.Chacha20Poly1305,
    });

    if (!enc) throw new Error(`Encapsulation key is missing.`);

    const recipientContext = await suite.createRecipientContext({
      recipientKey: group.secret.privateKey,
      enc, // Use the encapsulation key from the sender
    });

    const plaintext = await recipientContext.open(ciphertext);

    console.log(
      `Message received by '${recipient}' in group '${groupId}': ${new TextDecoder().decode(
        plaintext
      )}`
    );
    return new TextDecoder().decode(plaintext);
  }

  async updateEpoch(groupId) {
    const group = this.groups[groupId];
    if (!group) throw new Error(`Group '${groupId}' does not exist.`);

    group.epoch += 1;
    group.secret = await this.generateGroupSecret();
    console.log(`Group '${groupId}' updated to epoch ${group.epoch}.`);
  }

  async generateGroupSecret() {
    const keyPair = await generateKeyPair();
    return {
      publicKey: await exportKey(keyPair.publicKey),
      privateKey: await exportKey(keyPair.privateKey),
    };
  }
}

export default MLS;
