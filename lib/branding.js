/** Shared message branding for FlowTech. */
export const FLOWTECH_FOOTER = '> 『˼فلو تيك˹ ❘❘ ˼𝙵𝙻𝙾𝚆𝚃𝙴𝙲𝙷˹』';

function appendFooter(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes(FLOWTECH_FOOTER)) return value;
  return `${value.trimEnd()}\n\n${FLOWTECH_FOOTER}`;
}

/** Adds the brand to text and media captions without changing media bytes or command behavior. */
export function decorateOutgoingContent(content) {
  if (!content || typeof content !== 'object') return content;
  const decorated = { ...content };
  if (typeof decorated.text === 'string') decorated.text = appendFooter(decorated.text);
  if (typeof decorated.caption === 'string') decorated.caption = appendFooter(decorated.caption);

  // Native interactive messages have a dedicated footer field. Keep the body intact.
  if (decorated.interactiveMessage && typeof decorated.interactiveMessage === 'object') {
    decorated.interactiveMessage = {
      ...decorated.interactiveMessage,
      footer: { text: FLOWTECH_FOOTER },
    };
  }
  return decorated;
}

/** Install once per Baileys socket so direct sendMessage calls are branded too. */
export function installBrandFooter(socket) {
  if (!socket || socket.__flowtechFooterInstalled) return socket;
  const originalSendMessage = socket.sendMessage.bind(socket);
  socket.sendMessage = async (jid, content, options) => {
    const result = await originalSendMessage(jid, decorateOutgoingContent(content), options);
    // WhatsApp audio messages do not reliably support a visible caption, so send the signature separately.
    if (content && typeof content === 'object' && content.audio && !content.text && !content.caption) {
      try { await originalSendMessage(jid, { text: FLOWTECH_FOOTER }, options); } catch { /* keep successful media delivery successful */ }
    }
    return result;
  };
  Object.defineProperty(socket, '__flowtechFooterInstalled', { value: true, configurable: false });
  return socket;
}
