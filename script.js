//смайлики для аватаров
const possibleEmojis = [
  '🐀','🐁','🐭','🐹','🐂','🐃','🐄','🐮','🐅','🐆','🐯','🐇','🐐','🐑','🐏','🐴',
  '🐎','🐱','🐈','🐰','🐓','🐔','🐤','🐣','🐥','🐦','🐧','🐘','🐩','🐕','🐷','🐖',
  '🐗','🐫','🐪','🐶','🐺','🐻','🐨','🐼','🐵','🙈','🙉','🙊','🐒','🐉','🐲','🐊',
  '🐍','🐢','🐸','🐋','🐳','🐬','🐙','🐟','🐠','🐡','🐚','🐌','🐛','🐜','🐝','🐞',
];
//функция для рандомного выбора смайлика
function randomEmoji() {
  const randomIndex = Math.floor(Math.random() * possibleEmojis.length);
  return possibleEmojis[randomIndex];
}
const emoji = randomEmoji();
//Переменная с именем пользователя для текстового чата
const name = prompt("Введите свое имя");

if (!location.hash) {
  location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
}
//Генерация хеш-данных для создания уникального URL-адреса
const roomHash = location.hash.substring(1);
//Данные, для подключения к связующему серверу
const drone = new ScaleDrone('b4hwSfoKT8CniGIh');
//Присвоение комнате рандомного имени
const roomName = 'observable-' + roomHash;
//Публичный STUN-сервер
const configuration = {
  iceServers: [{
    urls: 'stun:stun1.l.google.com:19302'
  }]
};
let room;
let pc;
let dataChanenl;


function onSuccess() {};
function onError(error) {
  console.error(error);
};
//подключение к Scaledrone
drone.on('open', error => {
  if (error) {
    return console.error(error);
  }
  room = drone.subscribe(roomName);
  room.on('open', error => {
    if (error) {
      onError(error);
    }
  });
  // Кто подключен к комнате, включая нас
  room.on('members', members => {
    console.log('MEMBERS', members);
    // Если мы второй пользователь, то создается Offer
    const isOfferer = members.length === 2;
    startWebRTC(isOfferer);
  });
});

// Отправляет сигнальные данные черзе Scaledrone
function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}

function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);

  // 'onicecandidate' уведомляет нас всякий раз, когда ICE-agent должен доставить
  // сообщение другому узлу через сервер сигнализации
  pc.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({'candidate': event.candidate});
    }
  };

  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer().then(localDescCreated).catch(onError);
    }
    dataChannel = pc.createDataChannel('chat');
    setupDataChannel();
  } else {
    pc.ondatachannel = event => {
      dataChannel = event.channel;
      setupDataChannel();
    }
  }

  function setupDataChannel() {
  checkDataChannelState();
  dataChannel.onopen = checkDataChannelState;
  dataChannel.onclose = checkDataChannelState;
  dataChannel.onmessage = event =>
    insertMessageToDOM(JSON.parse(event.data), false)
}
 
function checkDataChannelState() {
  console.log('WebRTC channel state is:', dataChannel.readyState);
}
  
  // Когда удаленный поток прибыл, его нужно отобразить в  элементе remoteVideo
  pc.ontrack = event => {
    const stream = event.streams[0];
    if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
      remoteVideo.srcObject = stream;
    }
  };

  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  }).then(stream => {
    // Отобразить ваш локальный видеопоток в элемент localVideo
    localVideo.srcObject = stream;
    // Отпрвление вашего потока в соединительный узел
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  }, onError);

  // Получение сигнальных сообщений из Scaledrone
  room.on('data', (message, client) => {
    // Сообщение было отправленно..
    if (client.id === drone.clientId) {
      return;
    }

    if (message.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
        console.log('pc.remoteDescription.type', pc.remoteDescription.type);
        if (pc.remoteDescription.type === 'offer') {
          console.log('Answering offer');
          pc.createAnswer(localDescCreated, error => console.error(error));
        }
      }, error => console.error(error));
    } else if (message.candidate) {
      pc.addIceCandidate(new RTCIceCandidate(message.candidate));
    }
  });
}

function localDescCreated(desc) {
  pc.setLocalDescription(
    desc,
    () => sendMessage({'sdp': pc.localDescription}),
    error => console.error(error)
  );
}

function insertMessageToDOM(options, isFromMe) {
  const template = document.querySelector('template[data-template="message"]');
  const nameEl = template.content.querySelector('.message__name');
  if (options.emoji || options.name) {
    nameEl.innerText = options.emoji + ' ' + options.name;
  }
  template.content.querySelector('.message__bubble').innerText = options.content;
  const clone = document.importNode(template.content, true);
  const messageEl = clone.querySelector('.message');
  if (isFromMe) {
    messageEl.classList.add('message--mine');
  } else {
    messageEl.classList.add('message--theirs');
  }
 
  const messagesEl = document.querySelector('.messages');
  messagesEl.appendChild(clone);
 
  messagesEl.scrollTop = messagesEl.scrollHeight - messagesEl.clientHeight;
}

const form = document.querySelector('form');
form.addEventListener('submit', () => {
  const input = document.querySelector('input[type="text"]');
  const value = input.value;
  input.value = '';
 
  const data = {
    name,
    content: value,
    emoji,
  };
 
  dataChannel.send(JSON.stringify(data));
 
  insertMessageToDOM(data, true);
});
