// ==========================================
// ⚙️ CẤU HÌNH HỆ THỐNG CLOUDFLARE WORKER
// ==========================================
const ADMIN_ID = '6138197737'; 
let users = {}; 
const userStates = {}; // Quản lý trạng thái nhập liệu tạm thời của khách
const userCooldowns = {};
const BRANDS = ["SC88", "C168", "CM88", "F8BET"];

export default {
  async fetch(request, env, ctx) {
    if (request.method === "POST") {
      try {
        const update = await request.json();
        const botToken = env.BOT_TOKEN || '8517026315:AAGSFv23fTHx2WFBSP25VJ5_-cBmU197BF8';
        
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
// 3. HÀM TẠO GIAO DIỆN MENU CHÍNH
// ==========================================
function getMainMenuKeyboard() {
  return {
    inline_keyboard: [
      // Hàng 1
      [
        { text: '🛍️ TRUNG TÂM MUA CODE MINI TRỰC TIẾP', callback_data: 'shop_code_mini', style: 'success' }
      ],
      // Hàng 2
      [
        { text: '🌐 DỊCH VỤ MẠNG XÃ HỘI', callback_data: 'social_service', style: 'success' }
      ],
      // Hàng 3
      [
        { text: '💳 NẠP TIỀN', callback_data: 'deposit', style: 'danger' }
      ],
      // Hàng 4
      [
        { text: '💎 TRUNG TÂM KHÁCH HÀNG', callback_data: 'cskh_center', style: 'primary' }
      ],
      // Hàng 5
      [
        { text: '🤖 BOT DỊCH VỤ VIETSUB', callback_data: 'bot_vietsub', style: 'success' }
      ],
      // Hàng 6
      [
        { text: '🎧 LIÊN HỆ CSKH', url: 'https://t.me/your_support', style: 'success' }
      ],
      // Hàng 7: Nút Quản trị
      [
        { text: '🛠️ ADMIN QUẢN LÝ XÂY DỰNG PHÁT TRIỂN Vietsub', callback_data: 'admin_panel', style: 'primary' }
      ]
    ]
  };
}

// ==========================================
// 4. LOGIC XỬ LÝ TIN NHẮN & NÚT BẤM
// ==========================================
async function handleUpdate(update, botToken, env) {
  // A. XỬ LÝ TIN NHẮN VĂN BẢN VÀ TRẠNG THÁI NGƯỜI DÙNG (USER STATES)
  if (update.message && update.message.text) {
    const msg = update.message;
    const chatId = msg.chat.id.toString();
    const text = msg.text.trim();
    const user = msg.from;

    if (!users[chatId]) {
        users[chatId] = {
            name: user.first_name || 'Khách',
            balance: 1501, voucher: 0, wonCodes: [], 
            linkedAccounts: { SC88: [], C168: [], CM88: [], F8BET: [] }
        };
    }

    // Xử lý lệnh /start
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

    // Xử lý lệnh /admin
    if (text.startsWith('/admin')) {
        if (chatId !== ADMIN_ID) {
            await callTelegramApi('sendMessage', { chat_id: chatId, text: '⛔ Sếp không có quyền sử dụng bảng điều khiển này!' }, botToken);
            return;
        }
        await callTelegramApi('sendMessage', { 
            chat_id: chatId, 
            text: '🛠️️ *BẢNG QUẢN TRỊ HỆ THỐNG*\n• /status\n• /user [ID]', 
            parse_mode: 'Markdown' 
        }, botToken);
        return;
    }

    // --- KIỂM TRA TRẠNG THÁI CHỜ NHẬP LIỆU (USER STATES) ---
    if (userStates[chatId]) {
      const state = userStates[chatId];
      const action = state.action;

      // 1. XỬ LÝ LOGIC LIÊN KẾT TÀI KHOẢN NHÀ CÁI
      if (action === 'waiting_link_account') {
        const brand = state.brand;
        
        // Lưu thông tin vào database giả định trong bộ nhớ
        if (!users[chatId].linkedAccounts[brand]) {
            users[chatId].linkedAccounts[brand] = [];
        }
        users[chatId].linkedAccounts[brand].push(text);

        delete userStates[chatId]; // Xóa trạng thái sau khi xử lý xong
        
        const successMsg = (
            `✅ *LIÊN KẾT THÀNH CÔNG!*\n\n` +
            `🏢 Nhà cái: *${brand}*\n` +
            `🔑 Tài khoản: \`${text}\`\n\n` +
            `Hệ thống đã đồng bộ dữ liệu bảo mật lên đám mây.`
        );
        const kb = {
          inline_keyboard: [
            [{ text: "◀ Quay lại", callback_data: `page_${brand}`, style: 'primary' }]
          ]
        };
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: successMsg,
          parse_mode: "Markdown",
          reply_markup: kb
        }, botToken);
        return;
      }

      // 2. XỬ LÝ LOGIC TĂNG MẮT LIVE TỰ ĐỘNG & KHẤU TRỪ TIỀN
      if (action === 'waiting_live_link') {
        const platform = state.platform;
        const cost = (platform === "TikTok") ? 10000 : 15000; // Định giá theo gói 1K mắt
        
        let u = users[chatId];
        let balance = u.balance;

        if (balance < cost) {
          delete userStates[chatId];
          const errorMsg = (
              `❌ *GIAO DỊCH THẤT BẠI*\n\n` +
              `Số dư tài khoản (\`${balance.toLocaleString()} VNĐ\`) không đủ để thực hiện mua 1,000 mắt Live ${platform}.\n` +
              `💰 Chi phí cần có: \`${cost.toLocaleString()} VNĐ\`.\n\n` +
              `Vui lòng nạp thêm tiền để tiếp tục sử dụng dịch vụ!`
          );
          const kb = {
            inline_keyboard: [
              [
                { text: "💳 Nạp Tiền", callback_data: "deposit", style: "danger" },
                { text: "🔙 Menu Chính", callback_data: "back_start", style: "primary" }
              ]
            ]
          };
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: errorMsg,
            parse_mode: "Markdown",
            reply_markup: kb
          }, botToken);
          return;
        }

        // Thực hiện trừ tiền
        u.balance = balance - cost;
        delete userStates[chatId];

        const successBuff = (
            `🚀 *KHỞI TẠO TIẾN TRÌNH BUFF MẮT THÀNH CÔNG!*\n` +
            `--------------------------------------------------\n` +
            `🎵 Nền tảng: *${platform} Live*\n` +
            `🔗 Liên kết: ${text}\n` +
            `👁️ Số lượng: \`1,000 mắt\`\n` +
            `💰 Khấu trừ: \`-${cost.toLocaleString()} VNĐ\`\n` +
            `💵 Số dư còn lại: \`${u.balance.toLocaleString()} VNĐ\`\n` +
            `--------------------------------------------------\n` +
            `⏱️ Mắt sẽ bắt đầu tăng đều sau 1-3 phút!`
        );
        const kb = {
          inline_keyboard: [
            [{ text: "🔙 Quay lại Menu Chính", callback_data: "back_start", style: "primary" }]
          ]
        };
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: successBuff,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
          reply_markup: kb
        }, botToken);
        return;
      }
    }
  }

  // B. XỬ LÝ NÚT BẤM (CALLBACK QUERY)
  if (update.callback_query) {
    const query = update.callback_query;
    const chatId = query.message.chat.id.toString();
    const messageId = query.message.message_id;
    const data = query.data;

    await callTelegramApi('answerCallbackQuery', { callback_query_id: query.id }, botToken);

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

    if (data === 'shop_code_mini') {
      subMenuText = '🛍️ *TRUNG TÂM MUA CODE MINI TRỰC TIẾP*\nVui lòng chọn các gói mã code trực tiếp bên dưới:';
    } else if (data === 'social_service') {
      subMenuText = '🌐 *DỊCH VỤ MẠNG XÃ HỘI*\nChọn dịch vụ bạn muốn trải nghiệm:';
      subMenuKeyboard = {
        inline_keyboard: [
          [
            { text: '🔴 Buff Mắt TikTok', callback_data: 'buff_tiktok', style: 'danger' },
            { text: '🔵 Buff Mắt Facebook', callback_data: 'buff_fb', style: 'primary' }
          ],
          [{ text: '🔙 Quay lại Menu Chính', callback_data: 'back_start', style: 'primary' }]
        ]
      };
    } else if (data === 'buff_tiktok') {
      userStates[chatId] = { action: 'waiting_live_link', platform: 'TikTok' };
      subMenuText = '🔴 *BUFF MẮT LIVESTREAM TIKTOK*\n\n👉 Vui lòng gửi **Link Livestream** hoặc **Username** của bạn vào khung chat ngay lúc này:';
    } else if (data === 'buff_fb') {
      userStates[chatId] = { action: 'waiting_live_link', platform: 'Facebook' };
      subMenuText = '🔵 *BUFF MẮT LIVESTREAM FACEBOOK*\n\n👉 Vui lòng gửi **Link Livestream** của bạn vào khung chat ngay lúc này:';
    } else if (data === 'deposit') {
      subMenuText = '💳 *NẠP TIỀN VÀO HỆ THỐNG*\nVui lòng chọn hình thức nạp tiền.';
    } else if (data === 'cshk_center') {
      subMenuText = '💎 *TRUNG TÂM KHÁCH HÀNG*\nQuản lý tài khoản, lịch sử giao dịch và hỗ trợ thành viên.';
    } else if (data === 'bot_vietsub') {
      subMenuText = '🤖 *BOT DỊCH VỤ VIETSUB*\nCông cụ hỗ trợ dịch thuật và quản lý tự động Vietsub.';
    } else if (data === 'admin_panel') {
        if (chatId !== ADMIN_ID) {
            subMenuText = '⛔ Bạn không có quyền truy cập khu vực quản trị!';
        } else {
            subMenuText = '🛠️ *ADMIN QUẢN LÝ XÂY DỰNG PHÁT TRIỂN Vietsub*\nChào sếp, hệ thống đang vận hành bình thường.';
        }
    } else {
      subMenuText = '⚙️ Tính năng đang được cập nhật...';
    }

    await callTelegramApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: subMenuText,
      parse_mode: 'Markdown',
      reply_markup: subMenuKeyboard
    }, botToken);
  }
}
