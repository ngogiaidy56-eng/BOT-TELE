// ==========================================
// ⚙️ CẤU HÌNH HỆ THỐNG CLOUDFLARE WORKER
// ==========================================
const ADMIN_ID = '6138197737'; 

// Database tạm trong bộ nhớ (Hỗ trợ mở rộng lên Cloudflare KV / D1 sau này)
let users = {}; 
const userStates = {};   // Quản lý trạng thái nhập liệu tạm thời của khách
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
      [
        { text: '🛍️ TRUNG TÂM MUA CODE MINI TRỰC TIẾP', callback_data: 'shop_code_mini', style: 'success' }
      ],
      [
        { text: '🌐 DỊCH VỤ MẠNG XÃ HỘI', callback_data: 'social_service', style: 'success' }
      ],
      [
        { text: '💳 NẠP TIỀN', callback_data: 'deposit', style: 'danger' }
      ],
      [
        { text: '💎 TRUNG TÂM KHÁCH HÀNG', callback_data: 'cskh_center', style: 'primary' }
      ],
      [
        { text: '🤖 BOT DỊCH VỤ VIETSUB', callback_data: 'bot_vietsub', style: 'success' }
      ],
      [
        { text: '🎧 LIÊN HỆ CSKH', url: 'https://t.me/your_support', style: 'success' }
      ],
      [
        { text: '🛠️ ADMIN QUẢN LÝ XÂY DỰNG PHÁT TRIỂN Vietsub', callback_data: 'admin_panel', style: 'primary' }
      ]
    ]
  };
}

// ==========================================
// 4. LOGIC XỬ LÝ TOÀN BỘ CẬP NHẬT (UPDATE)
// ==========================================
async function handleUpdate(update, botToken, env) {
  
  // ----------------------------------------------------
  // A. XỬ LÝ TIN NHẮN VĂN BẢN (TEXT & TRẠNG THÁI NHẬP LIỆU)
  // ----------------------------------------------------
  if (update.message && update.message.text) {
    const msg = update.message;
    const chatId = msg.chat.id.toString();
    const text = msg.text.trim();
    const user = msg.from;

    // Khởi tạo thông tin user nếu chưa có
    if (!users[chatId]) {
        users[chatId] = {
            name: user.first_name || 'Khách',
            balance: 50000, // Mặc định test 50k để chạy thử tính năng trừ tiền
            voucher: 0, 
            wonCodes: [], 
            linkedAccounts: { SC88: [], C168: [], CM88: [], F8BET: [] }
        };
    }
    const u = users[chatId];

    // Lệnh /start
    if (text.startsWith('/start')) {
      // Xóa mọi trạng thái cũ nếu có
      delete userStates[chatId];

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
        if (chatId !== ADMIN_ID) {
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

    // KIỂM TRA TRẠNG THÁI NHẬP LIỆU TẠM THỜI (user_states)
    if (userStates[chatId]) {
      const state = userStates[chatId];
      const action = state.action;

      // 1. XỬ LÝ LIÊN KẾT TÀI KHOẢN NHÀ CÁI
      if (action === 'waiting_link_account') {
        const brand = state.brand;
        
        // Lưu tài khoản vào database tạm
        if (!u.linkedAccounts[brand]) u.linkedAccounts[brand] = [];
        u.linkedAccounts[brand].push(text);

        delete userStates[chatId];
        
        const successMsg = (
            `✅ *LIÊN KẾT THÀNH CÔNG!*\n\n` +
            `🏢 Nhà cái: *${brand}*\n` +
            `🔑 Tài khoản: \`${text}\`\n\n` +
            `Hệ thống đã đồng bộ dữ liệu bảo mật lên đám mây.`
        );
        const kb = {
          inline_keyboard: [
            [{ text: "◀ Quay lại Trung Tâm KH", callback_data: "cshk_center", style: "primary" }]
          ]
        };
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: successMsg,
          parse_mode: 'Markdown',
          reply_markup: kb
        }, botToken);
        return;
      }

      // 2. XỬ LÝ TĂNG MẮT LIVE TỰ ĐỘNG & KHẤU TRỪ TIỀN
      if (action === 'waiting_live_link') {
        const platform = state.platform;
        const cost = platform === "TikTok" ? 10000 : 15000; // 10k cho TikTok, 15k cho Facebook
        
        // Kiểm tra số dư
        if (u.balance < cost) {
          delete userStates[chatId];
          const errorMsg = (
              `❌ *GIAO DỊCH THẤT BẠI*\n\n` +
              `Số dư tài khoản (\`${u.balance.toLocaleString()} VNĐ\`) không đủ để mua 1,000 mắt Live ${platform}.\n` +
              `💰 Chi phí cần có: \`${cost.toLocaleString()} VNĐ\`.\n\n` +
              `Vui lòng nạp thêm tiền để tiếp tục sử dụng dịch vụ!`
          );
          const kb = {
            inline_keyboard: [
              [{ text: "💳 Nạp Tiền", callback_data: "deposit", style: "danger" },
               { text: "🔙 Menu Chính", callback_data: "back_start", style: "primary" }]
            ]
          };
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: errorMsg,
            parse_mode: 'Markdown',
            reply_markup: kb
          }, botToken);
          return;
        }

        // Trừ tiền và cập nhật balance
        u.balance -= cost;
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
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: kb
        }, botToken);
        return;
      }
    }
  }

  // ----------------------------------------------------
  // B. XỬ LÝ NÚT BẤM (CALLBACK QUERY)
  // ----------------------------------------------------
  if (update.callback_query) {
    const query = update.callback_query;
    const chatId = query.message.chat.id.toString();
    const messageId = query.message.message_id;
    const data = query.data;

    // Đảm bảo user có dữ liệu
    if (!users[chatId]) {
        users[chatId] = { name: 'Khách', balance: 50000, linkedAccounts: { SC88: [], C168: [], CM88: [], F8BET: [] } };
    }
    const u = users[chatId];

    // Xác nhận đã bấm nút với Telegram để mất hiệu ứng loading
    await callTelegramApi('answerCallbackQuery', { callback_query_id: query.id }, botToken);

    // 1. Nút quay về Menu chính
    if (data === 'back_start') {
      delete userStates[chatId];
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

    // 2. Xử lý các menu chức năng
    if (data === 'shop_code_mini') {
      subMenuText = '🛍️ *TRUNG TÂM MUA CODE MINI TRỰC TIẾP*\nVui lòng chọn các gói mã code trực tiếp bên dưới:';
      subMenuKeyboard = {
        inline_keyboard: [
          [{ text: '🎮 Mua Code V2 Liên Kết', callback_data: 'buy_v2', style: 'success' }],
          [{ text: '🔙 Quay lại Menu Chính', callback_data: 'back_start', style: 'primary' }]
        ]
      };
    } 
    else if (data === 'social_service') {
      subMenuText = '🌐 *DỊCH VỤ MẠNG XÃ HỘI*\nHệ thống buff tương tác tự động. Vui lòng chọn dịch vụ:';
      subMenuKeyboard = {
        inline_keyboard: [
          [{ text: '🎵 Buff 1K Mắt TikTok Live (10k VNĐ)', callback_data: 'buff_tiktok', style: 'danger' }],
          [{ text: '📘 Buff 1K Mắt Facebook Live (15k VNĐ)', callback_data: 'buff_fb', style: 'danger' }],
          [{ text: '🔙 Quay lại Menu Chính', callback_data: 'back_start', style: 'primary' }]
        ]
      };
    } 
    // Kích hoạt trạng thái nhập link buff mắt TikTok
    else if (data === 'buff_tiktok') {
      userStates[chatId] = { action: 'waiting_live_link', platform: 'TikTok' };
      subMenuText = '🎵 *BUFF 1K MẮT TIKTOK LIVE*\n\n👉 Vui lòng gửi **Link hoặc Username Livestream TikTok** của bạn ngay vào khung chat:';
    }
    // Kích hoạt trạng thái nhập link buff mắt Facebook
    else if (data === 'buff_fb') {
      userStates[chatId] = { action: 'waiting_live_link', platform: 'Facebook' };
      subMenuText = '📘 *BUFF 1K MẮT FACEBOOK LIVE*\n\n👉 Vui lòng gửi **Link bài viết Livestream Facebook** của bạn ngay vào khung chat:';
    }
    else if (data === 'deposit') {
      subMenuText = '💳 *NẠP TIỀN VÀO HỆ THỐNG*\nChuyển khoản tự động qua Momo/Banking.\nSố dư hiện tại của bạn: `' + u.balance.toLocaleString() + ' VNĐ`';
    } 
    else if (data === 'cshk_center') {
      // Liệt kê tài khoản đã liên kết
      let linkedInfo = "";
      BRANDS.forEach(brand => {
        let accs = u.linkedAccounts[brand] || [];
        linkedInfo += `• *${brand}*: ${accs.length > 0 ? accs.join(', ') : 'Chưa liên kết'}\n`;
      });

      subMenuText = `💎 *TRUNG TÂM KHÁCH HÀNG*\n\n🏢 *Danh sách liên kết nhà cái của bạn:*\n${linkedInfo}\n👇 Chọn nhà cái bạn muốn liên kết thêm bên dưới:`;
      
      // Tạo nút bấm liên kết cho từng nhà cái
      subMenuKeyboard = {
        inline_keyboard: [
          [
            { text: '🔗 SC88', callback_data: 'link_SC88', style: 'success' },
            { text: '🔗 C168', callback_data: 'link_C168', style: 'success' }
          ],
          [
            { text: '🔗 CM88', callback_data: 'link_CM88', style: 'success' },
            { text: '🔗 F8BET', callback_data: 'link_F8BET', style: 'success' }
          ],
          [{ text: '🔙 Quay lại Menu Chính', callback_data: 'back_start', style: 'primary' }]
        ]
      };
    } 
    // Khi bấm chọn liên kết nhà cái cụ thể
    else if (data.startsWith('link_')) {
      const brand = data.replace('link_', '');
      userStates[chatId] = { action: 'waiting_link_account', brand: brand };
      subMenuText = `🔗 *LIÊN KẾT TÀI KHOẢN ${brand}*\n\n👉 Vui lòng nhập **Tên đăng nhập hoặc ID tài khoản ${brand}** của bạn vào khung chat:`;
    }
    else if (data === 'bot_vietsub') {
      subMenuText = '🤖 *BOT DỊCH VỤ VIETSUB*\nCông cụ hỗ trợ dịch thuật và quản lý tự động Vietsub.';
    } 
    else if (data === 'admin_panel') {
        if (chatId !== ADMIN_ID) {
            subMenuText = '⛔ Bạn không có quyền truy cập khu vực quản trị!';
        } else {
            subMenuText = '🛠️ *ADMIN QUẢN LÝ XÂY DỰNG PHÁT TRIỂN Vietsub*\nChào sếp, hệ thống đang vận hành bình thường. Tổng số user: ' + Object.keys(users).length;
        }
    } else {
      subMenuText = '⚙️ Tính năng đang được cập nhật...';
    }

    // Cập nhật lại giao diện tin nhắn
    await callTelegramApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: subMenuText,
      parse_mode: 'Markdown',
      reply_markup: subMenuKeyboard
    }, botToken);
  }
}
