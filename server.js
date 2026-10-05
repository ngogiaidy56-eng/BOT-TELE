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
        const botToken = env.BOT_TOKEN || '8619462252:AAFFVE7SdOAoA6JQn2wYWKwT4jTnYmKVWUs';
        
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
// 3. HÀM TẠO GIAO DIỆN MENU CHÍNH (CHUẨN MẪU MÀU SẮC)
// ==========================================
function getMainMenuKeyboard() {
  return {
    inline_keyboard: [
      // Hàng 1: Màu Đỏ (danger) và Xanh lá (success)
      [
        { text: '🚀 MINIGAME LIVE', callback_data: 'minigame', style: 'danger' },
        { text: '🛍️ SHOP CODE', callback_data: 'shop_code', style: 'success' }
      ],
      // Hàng 2: Màu Đỏ và Xanh lá
      [
        { text: '💳 NẠP TIỀN', callback_data: 'deposit', style: 'danger' },
        { text: '💎 TRUNG TÂM VIP', callback_data: 'vip', style: 'success' }
      ],
      // Hàng 3: Toàn dải Xanh dương đậm (primary)
      [
        { text: '💎 TRUNG TÂM KHÁCH HÀNG', callback_data: 'cskh_center', style: 'primary' }
      ],
      // Hàng 4: 
      [
        { text: '👤 NUÔI ACC HỘ', callback_data: 'nuoi_acc', style: 'success' },
        { text: '🤖 BOT DỊCH VỤ', url: 'https://t.me/your_bot_link', style: 'success' }
      ],
      // Hàng 5:
      [
        { text: '💬 NHÓM CHAT', url: 'https://t.me/your_group', style: 'success' },
        { text: '📢 KÊNH THÔNG BÁO', url: 'https://t.me/your_channel', style: 'success' }
      ],
      // Hàng 6:
      [
        { text: '🎁 NHẬP GIFCODE', callback_data: 'giftcode', style: 'success' },
        { text: '🎧 LIÊN HỆ CSKH', url: 'https://t.me/your_support', style: 'success' }
      ],
      // Hàng 7: Nút dài Xanh dương đậm
      [
        { text: '👥 GIỚI THIỆU BẠN BÈ REF', callback_data: 'referral', style: 'primary' }
      ]
    ]
  };
}

// ==========================================
// 4. LOGIC XỬ LÝ TIN NHẮN & NÚT BẤM
// ==========================================
async function handleUpdate(update, botToken, env) {
  // XỬ LÝ TIN NHẮN VĂN BẢN
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
        reply_markup: getMainMenuKeyboard()
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

  // XỬ LÝ NÚT BẤM (CALLBACK QUERY)
  if (update.callback_query) {
    const query = update.callback_query;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    // Đóng trạng thái loading của nút bấm ngay lập tức
    await callTelegramApi('answerCallbackQuery', { callback_query_id: query.id }, botToken);

    // Xử lý từng chức năng khi bấm nút
    if (data === 'back_start') {
      const u = users[chatId] || { name: 'Khách', balance: 0 };
      const welcomeMessage = `
🤖 *BOT HENDY CYBERTECH 2026* [BOT CHÍNH] 🚀
Chào mừng bạn quay lại, *${u.name}* (ID: \`${chatId}\`)
--------------------------------------------------
💎 *VIP 0*
💰 **Ví Chính:** \`${u.balance.toLocaleString()} VNĐ\`
      `;
      await callTelegramApi('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: welcomeMessage,
        parse_mode: 'Markdown',
        reply_markup: getMainMenuKeyboard()
      }, botToken);
      return;
    }

    let subMenuText = '';
    let subMenuKeyboard = {
      inline_keyboard: [
        [{ text: '🔙 Quay lại Menu Chính', callback_data: 'back_start', style: 'primary' }]
      ]
    };

    if (data === 'minigame') {
      subMenuText = '🎮 *MINIGAME LIVE*\nTham gia các trò chơi may mắn nhận thưởng ngay!';
    } else if (data === 'shop_code' || data === 'buy_code') {
      subMenuText = '🛍️ *TRUNG TÂM MUA CODE*\nVui lòng chọn loại mã code bạn muốn mua:';
      subMenuKeyboard = {
        inline_keyboard: [
          [{ text: '🎮 V2 LIÊN KẾT', callback_data: 'v2_links', style: 'success' }],
          [{ text: '🔙 Quay lại Menu Chính', callback_data: 'back_start', style: 'primary' }]
        ]
      };
    } else if (data === 'deposit') {
      subMenuText = '💳 *NẠP TIỀN VÀO HỆ THỐNG*\nVui lòng chọn hình thức nạp tiền bên dưới.';
    } else if (data === 'vip') {
      subMenuText = '💎 *TRUNG TÂM VIP*\nQuyền lợi và các mốc nâng hạng VIP của bạn.';
    } else if (data === 'cshk_center' || data === 'cskh_center') {
      subMenuText = '💎 *TRUNG TÂM KHÁCH HÀNG*\nQuản lý tài khoản, lịch sử giao dịch và hỗ trợ thành viên.';
    } else if (data === 'nuoi_acc') {
      subMenuText = '👤 *DỊCH VỤ NUÔI ACC HỘ*\nHệ thống tự động nuôi tài khoản an toàn.';
    } else if (data === 'giftcode') {
      subMenuText = '🎁 *NHẬP GIFCODE*\nHãy gửi mã quà tặng của bạn vào đây.';
    } else if (data === 'referral') {
      subMenuText = '👥 *GIỚI THIỆU BẠN BÈ REF*\nLink giới thiệu của bạn: `https://t.me/YourBot?start=ref_' + chatId + '`';
    } else {
      subMenuText = '⚙️ Tính năng đang được phát triển thêm...';
    }

    // Cập nhật nội dung tin nhắn thành menu con tương ứng
    await callTelegramApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: subMenuText,
      parse_mode: 'Markdown',
      reply_markup: subMenuKeyboard
    }, botToken);
  }
}
