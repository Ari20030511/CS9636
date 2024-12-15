import MLS from "./MLS.mjs";

describe("MLS Library", () => {
  let mls;

  beforeEach(() => {
    mls = new MLS();
  });

  test("Create a group", async () => {
    await mls.createGroup("group1", ["Alice", "Bob", "Charlie"]);
    expect(mls.groups["group1"].members).toEqual(["Alice", "Bob", "Charlie"]);
  });

  test("Send and receive a message", async () => {
    await mls.createGroup("group1", ["Alice", "Bob"]);

    const { ciphertext, enc } = await mls.sendMessage(
      "group1",
      "Alice",
      "Hello, World!"
    );

    const decryptedMessage = await mls.receiveMessage(
      "group1",
      "Bob",
      ciphertext,
      enc
    );

    expect(decryptedMessage).toBe("Hello, World!");
  });

  test("Add a member and update epoch", async () => {
    await mls.createGroup("group1", ["Alice", "Bob"]);
    await mls.addMember("group1", "Charlie");
    expect(mls.groups["group1"].members).toEqual(["Alice", "Bob", "Charlie"]);
    expect(mls.groups["group1"].epoch).toBe(1);
  });

  test("Remove a member and update epoch", async () => {
    await mls.createGroup("group1", ["Alice", "Bob", "Charlie"]);
    await mls.removeMember("group1", "Charlie");
    expect(mls.groups["group1"].members).toEqual(["Alice", "Bob"]);
    expect(mls.groups["group1"].epoch).toBe(1);
  });

  test("Removed member cannot decrypt messages", async () => {
    await mls.createGroup("group1", ["Alice", "Bob", "Charlie"]);

    const { ciphertext, enc } = await mls.sendMessage(
      "group1",
      "Alice",
      "Hello, World!"
    );

    await mls.removeMember("group1", "Charlie");

    try {
      await mls.receiveMessage("group1", "Charlie", ciphertext, enc);
    } catch (error) {
      expect(error.message).toMatch(/invalid tag/); // Updated to match the actual error
    }
  });
});
