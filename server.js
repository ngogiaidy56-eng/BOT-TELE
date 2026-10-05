// ==========================================
// ⚙️ CẤU HÌNH HỆ THỐNG CLOUDFLARE WORKER
// ==========================================
const ADMIN_ID = '6138197737'; 
// Cấu hình Database tạm thời trong bộ nhớ (LƯU Ý: Sẽ bị reset khi Worker khởi động lại. Cần dùng Cloudflare KV để lưu trữ lâu dài)
let users = {}; 
const userStates = {};
const userCooldowns = {};

export default {
  async fetch(request, env, ctx) {
    // 1. Chỉ chấp nhận các request dạng POST từ Telegram Webhook
    if (request.method === "POST") {
      try {
        const update = await request.json();
        const botToken = env.BOT_TOKEN || '8971349527:AAGG8lNFWdBj742RADHCG51TAFYUnuDJYYE';
        
        // Chạy xử lý ngầm để tránh Timeout cho Telegram
        ctx.waitUntil(handleUpdate(update, botToken, env));
        
        return new Response("OK", { status: 200 });
      } catch (e) {
        return new Response("Lỗi xử lý", { status: 500 });
      }
    }
    
    return new Response("🤖 Bot Telegram Hendy Cybertech đang chạy trên Cloudflare Worker!");
  }
};

// ==========================================
// 2. HÀM GIAO TIẾP VỚI TELEGRAM API
// ==========================================
async function callTelegramApi(method, payload, botToken) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

// ==========================================
// 3. LOGIC XỬ LÝ TIN NHẮN & NÚT BẤM (CỦA BẠN)
// ==========================================
async function handleUpdate(update, botToken, env) {
  // XỬ LÝ TIN NHẮN VĂN BẢN (Tương đương bot.on('message'))
  if (update.message && update.message.text) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text;
    const user = msg.from;

    // Khởi tạo user nếu chưa có
    if (!users[chatId]) {
        users[chatId] = {
            name: user.first_name || 'Khách',
            balance: 1501, voucher: 0, wonCodes: [], 
            linkedAccounts: { SC88: [], C168: [], CM88: [], F8BET: [] }
        };
        // TODO: Cập nhật lưu data vào Cloudflare KV tại đây thay vì fs.writeFileSync
    }

    // Lệnh /start
    if (text.startsWith('/start')) {
      const u = users[chatId];
      const welcomeMessage = `
🤖 *BOT HENDY CYBERTECH 2026* [BOT CHÍNH] 🚀
Buổi chiều vui vẻ nhé, *${u.name}* (ID: \`${chatId}\`)
--------------------------------------------------
💎 *VIP 0*
💰 **Ví Chính:** \`${u.balance.toLocaleString()} VNĐ\`
      `;

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: welcomeMessage,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎟️ TRUNG TÂM MUA CODE', callback_data: 'buy_code' }],
            [{ text: '💳 NẠP TIỀN', callback_data: 'deposit' }]
          ]
        }
      }, botToken);
      return;
    }

    // Lệnh /admin
    if (text.startsWith('/admin')) {
        if (chatId.toString() !== ADMIN_ID) {
            await callTelegramApi('sendMessage', { chat_id: chatId, text: '⛔ Sếp không có quyền sử dụng bảng điều khiển này!' }, botToken);
            return;
        }
        await callTelegramApi('sendMessage', { 
            chat_id: chatId, 
            text: '🛠️ *BẢNG QUẢN TRỊ HỆ THỐNG*\n• /status\n• /user [ID]', 
            parse_mode: 'Markdown' 
        }, botToken);
        return;
    }
  }

  // XỬ LÝ NÚT BẤM (Tương đương bot.on('callback_query'))
  if (update.callback_query) {
    const query = update.callback_query;
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === 'buy_code') {
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `🖤 *TRUNG TÂM MUA CODE*`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎮 V2 LIÊN KẾT', callback_data: 'v2_links' }],
            [{ text: '🔙 Quay lại', callback_data: 'back_start' }]
          ]
        }
      }, botToken);
    }
    
    // Đóng trạng thái loading của nút bấm
    await callTelegramApi('answerCallbackQuery', { callback_query_id: query.id }, botToken);
  }
}
