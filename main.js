import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Graphics variables
let container;
let camera, controls, scene, renderer;
let textureLoader;
let gltfLoader;
const clock = new THREE.Clock();
let clickRequest = false;
let lastShotTime = 0;
const shotCooldown = 500; // 0.5秒のクールダウン
const mouseCoords = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const ballMaterial = new THREE.MeshPhongMaterial( { color: 0x202020 } );
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();

// Physics variables
const gravityConstant = - 9.8;
let physicsWorld;
const rigidBodies = [];
const margin = 0.05;
let transformAux1;

// ドーナツステージ関連の変数
let donutStage;
let donutPhysicsBodies = []; // ドーナツの物理ボディ配列
let boxesOnRing = []; // リング上のボックス配列
const donutRotationSpeed = 0.5; // ドーナツの回転速度
const donutRadius = 8; // ドーナツの外径
const donutTubeRadius = 3; // ドーナツの内径

// スコアシステム関連の変数
let score = 0;
let gameTime = 15; // 15秒のゲーム時間
let gameStartTime = null;
let isGameActive = false;
let lastResultTime = 0; // 最後にリザルトを表示した時間
let isShowingResult = false; // リザルト演出中かどうか
let isShowingCountdown = false; // カウントダウン表示中フラグ
let lastCountdownNumber = -1; // 最後に表示したカウントダウン数字

// ゲーム進行システム関連の変数
let unlockedWeapons = ['beer']; // アンロック済み武器
let weaponUnlockThresholds = {
    beer: 0,        // ビール: 最初からアンロック
    cocktail: 50,   // カクテル: 50ポイントでアンロック
    bomb: 100       // 爆弾: 100ポイントでアンロック
};
let highestScore = 0; // 最高スコア
let scoreHistory = []; // スコア履歴（最大10件）

// 通貨システム関連の変数
let playerMoney = 0; // プレイヤーの所持金
let gameStartMoney = 0; // ゲーム開始時の所持金（リールアニメーション用）
let weaponPrices = {
    beer: 0,        // ビール: 無料（最初から所有）
    cocktail: 150000, // カクテル: $150,000
    bomb: 500000    // 爆弾: $500,000
};
let ownedWeapons = ['beer']; // 購入済み武器（最初はビールのみ）

// ローディング関連の変数
let loadingProgress = 0;
let totalResources = 0;
let loadedResources = 0;
let isGameLoaded = false;
let isLoadingFinished = false; // 読み込み完了フラグを追加

// 3Dモデル読み込み管理用の変数
let totalModelsToLoad = 0;
let modelsLoaded = 0;
let isLoadingModels = false;

// 球選択関連の変数
let selectedProjectileType = null;
let projectileTypes = {
    beer: {
        model: 'beer.glb',
        scale: 0.3,
        mass: 3,
        velocity: 14,
        cooldown: 500,
        name: 'Beer Bottle'
    },
    cocktail: {
        model: 'cocktail.glb',
        scale: 0.25,
        mass: 2,
        velocity: 18,
        cooldown: 250,
        name: 'Cocktail Glass'
    },
    bomb: {
        model: 'bomb.glb',
        scale: 0.35,
        mass: 4,
        velocity: 12,
        cooldown: 1000,
        name: 'Party Bomb',
        explosionDelay: 2000,
        explosionRadius: 5
    }
};

// Audio variables for BGM
let selectionBGM = null;
let gameBGM = null; // ゲーム中のBGM
let hoverSound = null;
let startSound = null; // スタートボタン用音声
let selectSound = null; // 武器選択音
let beerSound = null; // ビール発射音
let cocktailSound = null; // カクテル発射音
let bombSound = null; // 爆発音
let getSound = null; // 穴に入った時の効果音
let badSound = null; // マイナスアイテム獲得音
let hitSound = null; // オブジェクトに当たった時の効果音
let isSoundEnabled = true; // 音声のオン/オフ状態
let audioPreloaded = false; // 音声ファイルの事前読み込み完了フラグ
let userHasInteracted = false; // ユーザーが操作したかのフラグ

function initCustomCursor() {
    console.log('🎯 Initializing custom crosshair cursor');
    
    // Simple cursor application for 48x48 pre-made image
    const cursorStyle = `url('pointer.png') 24 24, crosshair`;
    document.body.style.cursor = cursorStyle;
    
    // Also apply to container
    const container = document.getElementById('container');
    if (container) {
        container.style.cursor = cursorStyle;
    }
    
    console.log('🎯 Custom crosshair cursor applied successfully');
}

function loadGameProgress() {
    try {
        // 最高スコアを読み込み
        const savedHighestScore = localStorage.getItem('medarion_highest_score');
        if (savedHighestScore) {
            highestScore = parseInt(savedHighestScore, 10);
            console.log(`🏆 Loaded highest score: ${highestScore}`);
        }
        
        // スコア履歴を読み込み
        const savedScoreHistory = localStorage.getItem('medarion_score_history');
        if (savedScoreHistory) {
            scoreHistory = JSON.parse(savedScoreHistory);
            console.log(`📊 Loaded score history: ${scoreHistory.length} entries`);
        }
        
        // プレイヤーの所持金を読み込み
        const savedMoney = localStorage.getItem('medarion_player_money');
        if (savedMoney) {
            playerMoney = parseInt(savedMoney, 10);
            console.log(`💰 Loaded player money: $${playerMoney.toLocaleString()}`);
        }
        
        // 購入済み武器を読み込み
        const savedOwnedWeapons = localStorage.getItem('medarion_owned_weapons');
        if (savedOwnedWeapons) {
            ownedWeapons = JSON.parse(savedOwnedWeapons);
            console.log(`🔫 Loaded owned weapons: ${ownedWeapons.join(', ')}`);
        }
        
        // 後方互換性のため、古いアンロックシステムのデータがあれば移行
        const savedUnlockedWeapons = localStorage.getItem('medarion_unlocked_weapons');
        if (savedUnlockedWeapons && !savedOwnedWeapons) {
            const oldUnlockedWeapons = JSON.parse(savedUnlockedWeapons);
            ownedWeapons = oldUnlockedWeapons;
            console.log(`🔄 Migrated from old unlock system: ${ownedWeapons.join(', ')}`);
        }
        
        // unlockedWeaponsをownedWeaponsと同期（表示用）
        unlockedWeapons = [...ownedWeapons];
        
    } catch (error) {
        console.error('Failed to load game progress:', error);
    }
}

function saveGameProgress() {
    try {
        localStorage.setItem('medarion_highest_score', highestScore.toString());
        localStorage.setItem('medarion_score_history', JSON.stringify(scoreHistory));
        localStorage.setItem('medarion_player_money', playerMoney.toString());
        localStorage.setItem('medarion_owned_weapons', JSON.stringify(ownedWeapons));
        // 後方互換性のため古いキーも更新
        localStorage.setItem('medarion_unlocked_weapons', JSON.stringify(ownedWeapons));
        console.log('💾 Game progress saved successfully');
    } catch (error) {
        console.error('Failed to save game progress:', error);
    }
}

function updateProgressAfterGame(finalScore) {
    // 最高スコア更新
    if (finalScore > highestScore) {
        highestScore = finalScore;
        console.log(`🎉 New high score: ${highestScore}!`);
    }
    
    // スコア履歴に追加（最新10件を保持）- 重複防止
    const isDuplicate = scoreHistory.length > 0 && 
                       scoreHistory[0].score === finalScore && 
                       scoreHistory[0].date === new Date().toLocaleDateString('ja-JP');
    
    if (!isDuplicate) {
        scoreHistory.unshift({
            score: finalScore,
            date: new Date().toLocaleDateString('ja-JP'),
            time: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        });
        
        if (scoreHistory.length > 10) {
            scoreHistory = scoreHistory.slice(0, 10);
        }
    }
    
    // 賞金は穴に落ちたアイテムからのみ（重複獲得防止）
    // finalScoreがプラスの場合のみ賞金獲得
    const earnedMoney = Math.max(0, finalScore * 1000);
    const previousMoney = playerMoney;
    
    // 一度だけ賞金を追加（ゲーム終了時の1回のみ）
    if (!window.gameRewardClaimed) {
        playerMoney += earnedMoney;
        window.gameRewardClaimed = true; // フラグを設定
        console.log(`💰 Earned $${earnedMoney.toLocaleString()} from items fallen into hole`);
    }
    
    console.log(`💰 Total money: $${playerMoney.toLocaleString()}`);
    
    // データを保存
    saveGameProgress();
    
    return {
        earnedMoney: earnedMoney,
        previousMoney: previousMoney,
        newTotal: playerMoney
    };
}

function preloadAudio() {
    console.log('🔄 Preloading audio files...');
    
    // タイムアウト機能を設定
    setupAudioTimeout();
    
    // BGMの事前読み込み（メニュー用）
    try {
        selectionBGM = new Audio('bgm/waltz.mp3');
        selectionBGM.preload = 'auto';
        selectionBGM.loop = true;
        selectionBGM.volume = 0.6;
        
        selectionBGM.addEventListener('canplaythrough', () => {
            console.log('🎵 Selection BGM preloaded successfully');
            checkAudioPreloadComplete();
        });
        
        selectionBGM.addEventListener('error', (e) => {
            console.error('🔇 Selection BGM preload failed:', e);
            checkAudioPreloadComplete();
        });
        
        selectionBGM.load();
        
    } catch (error) {
        console.error('🔇 Failed to initialize selection BGM:', error);
    }
    
    // ゲーム中BGMの事前読み込み
    try {
        gameBGM = new Audio('bgm/magebgm.mp3');
        gameBGM.preload = 'auto';
        gameBGM.loop = true;
        gameBGM.volume = 0.5;
        
        gameBGM.addEventListener('canplaythrough', () => {
            console.log('🎮 Game BGM preloaded successfully');
            checkAudioPreloadComplete();
        });
        
        gameBGM.addEventListener('error', (e) => {
            console.error('🔇 Game BGM preload failed:', e);
            checkAudioPreloadComplete();
        });
        
        gameBGM.load();
        
    } catch (error) {
        console.error('🔇 Failed to initialize game BGM:', error);
    }
    
    // ホバー音の事前読み込み
    try {
        hoverSound = new Audio('bgm/click.mp3');
        hoverSound.preload = 'auto';
        hoverSound.volume = 0.3;
        
        hoverSound.addEventListener('canplaythrough', () => {
            console.log('🔊 Hover sound preloaded successfully');
            checkAudioPreloadComplete();
        });
        
        hoverSound.addEventListener('error', (e) => {
            console.error('🔇 Hover sound preload failed:', e);
            checkAudioPreloadComplete();
        });
        
        hoverSound.load();
        
    } catch (error) {
        console.error('🔇 Failed to initialize hover sound:', error);
    }
    
    // スタート音の事前読み込み
    try {
        startSound = new Audio('bgm/clickstart.mp3');
        startSound.preload = 'auto';
        startSound.volume = 0.5;
        
        startSound.addEventListener('canplaythrough', () => {
            console.log('🚀 Start sound preloaded successfully');
            checkAudioPreloadComplete();
        });
        
        startSound.addEventListener('error', (e) => {
            console.error('🔇 Start sound preload failed:', e);
            checkAudioPreloadComplete();
        });
        
        startSound.load();
        
    } catch (error) {
        console.error('🔇 Failed to initialize start sound:', error);
    }
    
    // 武器選択音の事前読み込み
    try {
        selectSound = new Audio('bgm/clickselect.mp3');
        selectSound.preload = 'auto';
        selectSound.volume = 0.4;
        
        selectSound.addEventListener('canplaythrough', () => {
            console.log('🎯 Select sound preloaded successfully');
            checkAudioPreloadComplete();
        });
        
        selectSound.addEventListener('error', (e) => {
            console.error('🔇 Select sound preload failed:', e);
            checkAudioPreloadComplete();
        });
        
        selectSound.load();
        
    } catch (error) {
        console.error('🔇 Failed to initialize select sound:', error);
    }
    
    // ビール発射音の事前読み込み
    try {
        beerSound = new Audio('bgm/beer.mp3');
        beerSound.preload = 'auto';
        beerSound.volume = 0.4;
        
        beerSound.addEventListener('canplaythrough', () => {
            console.log('🍺 Beer sound preloaded successfully');
            checkAudioPreloadComplete();
        });
        
        beerSound.addEventListener('error', (e) => {
            console.error('🔇 Beer sound preload failed:', e);
            checkAudioPreloadComplete();
        });
        
        beerSound.load();
        
    } catch (error) {
        console.error('🔇 Failed to initialize beer sound:', error);
    }
    
    // カクテル発射音の事前読み込み
    try {
        cocktailSound = new Audio('bgm/cocktail.mp3');
        cocktailSound.preload = 'auto';
        cocktailSound.volume = 0.4;
        
        cocktailSound.addEventListener('canplaythrough', () => {
            console.log('🍸 Cocktail sound preloaded successfully');
            checkAudioPreloadComplete();
        });
        
        cocktailSound.addEventListener('error', (e) => {
            console.error('🔇 Cocktail sound preload failed:', e);
            checkAudioPreloadComplete();
        });
        
        cocktailSound.load();
        
    } catch (error) {
        console.error('🔇 Failed to initialize cocktail sound:', error);
    }
    
    // 爆発音の事前読み込み
    try {
        bombSound = new Audio('bgm/bomb.mp3');
        bombSound.preload = 'auto';
        bombSound.volume = 0.6;
        
        bombSound.addEventListener('canplaythrough', () => {
            console.log('💣 Bomb sound preloaded successfully');
            checkAudioPreloadComplete();
        });
        
        bombSound.addEventListener('error', (e) => {
            console.error('🔇 Bomb sound preload failed:', e);
            checkAudioPreloadComplete();
        });
        
        bombSound.load();
        
    } catch (error) {
        console.error('🔇 Failed to initialize bomb sound:', error);
    }
    
    // 獲得効果音の事前読み込み
    try {
        getSound = new Audio('bgm/get.mp3');
        getSound.preload = 'auto';
        getSound.volume = 0.5;
        
        getSound.addEventListener('canplaythrough', () => {
            console.log('✨ Get sound preloaded successfully');
            checkAudioPreloadComplete();
        });
        
        getSound.addEventListener('error', (e) => {
            console.error('🔇 Get sound preload failed:', e);
            checkAudioPreloadComplete();
        });
        
        getSound.load();
        
    } catch (error) {
        console.error('🔇 Failed to initialize get sound:', error);
    }
    
    // マイナスアイテム効果音の事前読み込み
    try {
        badSound = new Audio('bgm/bad.mp3');
        badSound.preload = 'auto';
        badSound.volume = 0.6;
        
        badSound.addEventListener('canplaythrough', () => {
            console.log('😈 Bad sound preloaded successfully');
            checkAudioPreloadComplete();
        });
        
        badSound.addEventListener('error', (e) => {
            console.error('🔇 Bad sound preload failed:', e);
            checkAudioPreloadComplete();
        });
        
        badSound.load();
        
    } catch (error) {
        console.error('🔇 Failed to initialize bad sound:', error);
    }
    
    // ヒット効果音の事前読み込み
    try {
        hitSound = new Audio('bgm/attackeditem.mp3');
        hitSound.preload = 'auto';
        hitSound.volume = 0.4;
        
        hitSound.addEventListener('canplaythrough', () => {
            console.log('💥 Hit sound preloaded successfully');
            checkAudioPreloadComplete();
        });
        
        hitSound.addEventListener('error', (e) => {
            console.error('🔇 Hit sound preload failed:', e);
            checkAudioPreloadComplete();
        });
        
        hitSound.load();
        
    } catch (error) {
        console.error('🔇 Failed to initialize hit sound:', error);
    }
    
    // ユーザー操作の検知リスナーを設定
    setupUserInteractionListeners();
}

function checkAudioPreloadComplete() {
    // 全ての音声ファイルが準備完了かチェック
    const bgmReady = selectionBGM && selectionBGM.readyState >= 4;
    const gameBgmReady = gameBGM && gameBGM.readyState >= 4;
    const hoverReady = hoverSound && hoverSound.readyState >= 4;
    const startReady = startSound && startSound.readyState >= 4;
    const selectReady = selectSound && selectSound.readyState >= 4;
    const beerReady = beerSound && beerSound.readyState >= 4;
    const cocktailReady = cocktailSound && cocktailSound.readyState >= 4;
    const bombReady = bombSound && bombSound.readyState >= 4;
    const getReady = getSound && getSound.readyState >= 4;
    const badReady = badSound && badSound.readyState >= 4;
    const hitReady = hitSound && hitSound.readyState >= 4;
    
    if (bgmReady && gameBgmReady && hoverReady && startReady && selectReady && beerReady && cocktailReady && bombReady && getReady && badReady && hitReady && !audioPreloaded) {
        audioPreloaded = true;
        console.log('✅ All audio files preloaded and ready!');
        
        // ユーザーが既に操作している場合は即座にBGM再生
        if (userHasInteracted) {
            setTimeout(() => {
                playBGMInstantly();
            }, 50);
        } else {
            console.log('🔇 Waiting for user interaction to start BGM...');
        }
    }
}

// 音声読み込みのタイムアウト機能
function setupAudioTimeout() {
    setTimeout(() => {
        if (!audioPreloaded) {
            console.log('⚠️ Audio preload timeout, marking as ready...');
            audioPreloaded = true; // フラグを強制的に設定
            
            // ユーザーが操作済みの場合のみBGM再生を試行
            if (userHasInteracted) {
                playBGM();
            } else {
                console.log('🔇 BGM will start when user interacts');
            }
        }
    }, 2000); // 2秒でタイムアウト
}

function initAudio() {
    // 互換性のための関数（既存コードとの互換性維持）
    if (!audioPreloaded) {
        preloadAudio();
    }
}

function playBGMInstantly() {
    if (selectionBGM && isSoundEnabled && userHasInteracted && selectionBGM.readyState >= 4) {
        // 音声が完全に読み込まれていて、ユーザーが操作済みの場合のみ再生
        selectionBGM.currentTime = 0; // 最初から再生
        
        const playPromise = selectionBGM.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('🎵 BGM started playing instantly!');
            }).catch(error => {
                console.warn('🔇 BGM playback failed:', error);
            });
        }
    } else if (!userHasInteracted) {
        console.log('🔇 BGM playback skipped - waiting for user interaction');
    } else {
        console.warn('🔇 BGM not ready for playback');
    }
}

function tryPlayBGMOnUserInteraction() {
    if (selectionBGM && isSoundEnabled && userHasInteracted) {
        selectionBGM.play().then(() => {
            console.log('🎵 BGM started after user interaction');
        }).catch(error => {
            console.error('🔇 BGM failed to play even after user interaction:', error);
        });
    }
}

// オーディオコンテキストの早期アクティベーション
function activateAudioContext() {
    try {
        // Web Audio APIが利用可能な場合、コンテキストを作成してアクティベート
        if (window.AudioContext || window.webkitAudioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContextClass();
            
            // 無音の短いオーディオバッファを作成して再生を試行
            const buffer = audioContext.createBuffer(1, 1, 22050);
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            source.start(0);
            
            console.log('🔊 Audio context activated proactively');
        }
    } catch (error) {
        console.log('ℹ️ Audio context activation skipped:', error.message);
    }
}

function playBGM() {
    // 改良版BGM再生（ユーザー操作確認後に再生）
    if (userHasInteracted && audioPreloaded) {
        playBGMInstantly();
    } else if (!userHasInteracted) {
        console.log('🔇 BGM playback requires user interaction first');
    } else {
        // まだプリロードが完了していない場合
        console.log('🔄 Audio still loading, will play when ready...');
    }
}

function playHoverSound() {
    if (hoverSound && isSoundEnabled && userHasInteracted) {
        hoverSound.currentTime = 0; // 最初から再生
        hoverSound.play().catch(error => {
            console.warn('🔇 Hover sound failed to play:', error);
        });
    } else if (!userHasInteracted) {
        // ユーザー操作前は音を鳴らさない（ブラウザポリシー準拠）
        console.log('🔇 Hover sound requires user interaction first');
    }
}

function stopBGM() {
    if (selectionBGM) {
        selectionBGM.pause();
        selectionBGM.currentTime = 0;
        console.log('🔇 Selection BGM stopped');
    }
    
    if (gameBGM) {
        gameBGM.pause();
        gameBGM.currentTime = 0;
        console.log('🔇 Game BGM stopped');
    }
}

function toggleSound() {
    isSoundEnabled = !isSoundEnabled;
    
    const soundToggle = document.getElementById('sound-toggle');
    const soundIcon = document.getElementById('sound-icon');
    
    if (isSoundEnabled) {
        soundIcon.textContent = '🔊';
        soundToggle.title = 'Turn off sound';
        console.log('🔊 Sound enabled');
        // BGMが再生中でない場合は再開
        if (selectionBGM && selectionBGM.paused) {
            playBGM();
        }
    } else {
        soundIcon.textContent = '🔇';
        soundToggle.title = 'Turn on sound';
        console.log('🔇 Sound disabled');
        // BGMを停止
        stopBGM();
    }
}

// Initialize custom cursor
initCustomCursor();

// スコアデータとプログレスを読み込み
loadGameProgress();

// Ammo.jsが利用可能なことを確認してから初期化を開始
if (typeof Ammo !== 'undefined') {
    // オーディオコンテキストを早期にアクティベート
    activateAudioContext();
    
    // 音声ファイルを早期に準備開始
    console.log('🔄 Early audio preloading...');
    preloadAudio();
    
    showProjectileSelection();
} else {
    console.error('Ammo.js is not available');
}

// 既存の「Go to Bar」ボタンを削除する関数
function removeExistingGoToBarButtons() {
    const existingButtons = document.querySelectorAll('.go-to-bar-button');
    existingButtons.forEach(button => {
        if (button && button.parentNode) {
            button.parentNode.removeChild(button);
        }
    });
    console.log(`🗑️ Removed ${existingButtons.length} existing Go to Bar buttons`);
}

function showProjectileSelection() {
    console.log('🎯 Showing projectile selection screen');
    
    // 音声ファイルの事前読み込みを即座に開始
    preloadAudio();
    
    // 既存の「Go to Bar」ボタンを削除
    removeExistingGoToBarButtons();
    
    const projectileSelection = document.getElementById('projectile-selection');
    const startButton = document.getElementById('start-game-button');
    const options = document.querySelectorAll('.projectile-option');
    
    // Initialize selection screen
    projectileSelection.style.display = 'flex';
    projectileSelection.classList.remove('hidden');
    
    // Create sound toggle button
    createSoundToggle();
    
    // Create ranking display button
    createRankingButton();
    
    // Create shop button
    createShopButton();
    
    // Create settings button
    createSettingsButton();
    
    // Create help button
    createHelpButton();
    
    // Create creator credit footer
    createCreatorCredit();
    
    // 所持武器に基づいて武器オプションを設定
    options.forEach(option => {
        const weaponType = option.dataset.type;
        const isOwned = ownedWeapons.includes(weaponType);
        
        // 既存のアンロック要求テキストを削除
        const existingUnlockText = option.querySelector('.unlock-requirement, .weapon-price');
        if (existingUnlockText) {
            existingUnlockText.remove();
        }
        
        // Clear existing event listeners by cloning the element
        const newOption = option.cloneNode(true);
        option.parentNode.replaceChild(newOption, option);
        
        if (!isOwned) {
            // 未購入の武器の場合
            newOption.classList.add('locked');
            newOption.style.opacity = '0.5';
            newOption.style.filter = 'grayscale(100%)';
            
            // 価格を表示
            const priceText = document.createElement('div');
            priceText.className = 'weapon-price';
            priceText.textContent = `$${weaponPrices[weaponType].toLocaleString()}`;
            priceText.style.cssText = `
                position: absolute;
                bottom: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 100, 0, 0.8);
                color: white;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
                z-index: 10;
            `;
            newOption.appendChild(priceText);
            
            // バーに行くボタンを追加（親要素の外に配置してgrayscaleを回避）
            const goToBarButton = document.createElement('button');
            goToBarButton.className = 'go-to-bar-button';
            goToBarButton.innerHTML = '🍻 Go to Bar';
            goToBarButton.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(45deg, #ff6b6b, #ee5a24) !important;
                color: white !important;
                border: none;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
                transition: all 0.3s ease;
                z-index: 15;
                pointer-events: auto;
                filter: saturate(2) !important;
            `;
            
            // ホバーエフェクト追加
            goToBarButton.addEventListener('mouseenter', () => {
                goToBarButton.style.transform = 'translate(-50%, -50%) scale(1.1)';
                goToBarButton.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.4)';
                goToBarButton.style.background = 'linear-gradient(45deg, #ff5252, #dd2c00) !important';
                playHoverSound();
            });
            
            goToBarButton.addEventListener('mouseleave', () => {
                goToBarButton.style.transform = 'translate(-50%, -50%) scale(1)';
                goToBarButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
                goToBarButton.style.background = 'linear-gradient(45deg, #ff6b6b, #ee5a24) !important';
            });
            
            // クリックでショップ開く
            goToBarButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                playSelectSound();
                showShopModal();
            });
            
            // 親コンテナに追加（newOptionではなく、その親要素に）
            const parentContainer = newOption.parentNode;
            parentContainer.style.position = 'relative'; // 相対位置指定のため
            
            // ボタンの位置を武器オプションに合わせて調整
            const rect = newOption.getBoundingClientRect();
            const parentRect = parentContainer.getBoundingClientRect();
            goToBarButton.style.left = (rect.left - parentRect.left + rect.width/2) + 'px';
            goToBarButton.style.top = (rect.top - parentRect.top + rect.height/2) + 'px';
            goToBarButton.style.transform = 'translate(-50%, -50%)';
            
            parentContainer.appendChild(goToBarButton);
            
            // クリック無効化
            newOption.style.pointerEvents = 'none';
        } else {
            // 購入済みの武器
            newOption.classList.remove('locked');
            newOption.style.opacity = '1';
            newOption.style.filter = 'none';
            newOption.style.pointerEvents = 'auto';
            
            // Add hover sound effect
            newOption.addEventListener('mouseenter', () => {
                playHoverSound();
            });
            
            newOption.addEventListener('click', () => {
                // 武器選択音を再生
                playSelectSound();
                
                // Remove selected class from all options
                document.querySelectorAll('.projectile-option').forEach(opt => opt.classList.remove('selected'));
                
                // Add selected class to clicked option
                newOption.classList.add('selected');
                
                // Store selected type
                selectedProjectileType = weaponType;
                
                // Enable start button
                startButton.disabled = false;
                
                console.log(`🎯 Selected projectile: ${projectileTypes[selectedProjectileType].name}`);
            });
        }
    });
    
    // 最初の購入済み武器を自動選択
    const updatedOptions = document.querySelectorAll('.projectile-option');
    const firstOwnedOption = Array.from(updatedOptions).find(option => 
        ownedWeapons.includes(option.dataset.type)
    );
    if (firstOwnedOption && !selectedProjectileType) {
        firstOwnedOption.classList.add('selected');
        selectedProjectileType = firstOwnedOption.dataset.type;
        startButton.disabled = false;
    }
    
    // Check if background images load successfully
    checkProjectileImages();
    
    // Clear existing start button event listeners
    const newStartButton = startButton.cloneNode(true);
    startButton.parentNode.replaceChild(newStartButton, startButton);
    
    // Add start button handler
    newStartButton.addEventListener('click', () => {
        if (selectedProjectileType) {
            // スタート音を再生
            playStartSound();
            
            console.log(`🚀 Starting game with ${projectileTypes[selectedProjectileType].name}`);
            hideProjectileSelection();
            initLoading();
        }
    });
}

function createSoundToggle() {
    // Check if sound toggle already exists
    if (document.getElementById('sound-toggle')) {
        return;
    }
    
    // Create sound toggle button
    const soundToggle = document.createElement('button');
    soundToggle.id = 'sound-toggle';
    soundToggle.className = 'sound-toggle';
    soundToggle.title = 'Turn off sound';
    soundToggle.onclick = toggleSound;
    
    const soundIcon = document.createElement('span');
    soundIcon.id = 'sound-icon';
    soundIcon.textContent = '🔊';
    soundToggle.appendChild(soundIcon);
    
    // Add to projectile selection screen
    const projectileSelection = document.getElementById('projectile-selection');
    if (projectileSelection) {
        projectileSelection.appendChild(soundToggle);
    }
    
    console.log('🔊 Sound toggle button created');
}

function createRankingButton() {
    // Check if ranking button already exists
    if (document.getElementById('ranking-button')) {
        return;
    }
    
    // Create ranking button
    const rankingButton = document.createElement('button');
    rankingButton.id = 'ranking-button';
    rankingButton.className = 'ranking-button';
    rankingButton.title = 'View score ranking';
    rankingButton.innerHTML = '🏆';
    
    // Add styles
    rankingButton.style.cssText = `
        position: absolute;
        top: 20px;
        left: 20px;
        width: 50px;
        height: 50px;
        border: none;
        background: linear-gradient(45deg, #FFD700, #FFA500);
        border-radius: 50%;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
        z-index: 1000;
    `;
    
    // Add click event listener
    rankingButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🏆 Ranking button clicked');
        showRankingModal();
    });
    
    // Add hover effects
    rankingButton.addEventListener('mouseenter', () => {
        rankingButton.style.transform = 'scale(1.1)';
        rankingButton.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.4)';
        playHoverSound();
    });
    
    rankingButton.addEventListener('mouseleave', () => {
        rankingButton.style.transform = 'scale(1)';
        rankingButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    });
    
    // Add to projectile selection screen
    const projectileSelection = document.getElementById('projectile-selection');
    if (projectileSelection) {
        projectileSelection.appendChild(rankingButton);
    }
    
    console.log('🏆 Ranking button created');
}

function createShopButton() {
    // Check if shop button already exists
    if (document.getElementById('shop-button')) {
        return;
    }
    
    // Create shop button
    const shopButton = document.createElement('button');
    shopButton.id = 'shop-button';
    shopButton.className = 'shop-button';
    shopButton.title = 'Bar Merry-Round';
    shopButton.innerHTML = '🛒';
    
    // Add styles
    shopButton.style.cssText = `
        position: absolute;
        top: 80px;
        left: 20px;
        width: 50px;
        height: 50px;
        border: none;
        background: linear-gradient(45deg, #32CD32, #228B22);
        border-radius: 50%;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
        z-index: 1000;
    `;
    
    // Add click event listener
    shopButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🛒 Shop button clicked');
        showShopModal();
    });
    
    // Add hover effects
    shopButton.addEventListener('mouseenter', () => {
        shopButton.style.transform = 'scale(1.1)';
        shopButton.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.4)';
        playHoverSound();
    });
    
    shopButton.addEventListener('mouseleave', () => {
        shopButton.style.transform = 'scale(1)';
        shopButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    });
    
    // Add to projectile selection screen
    const projectileSelection = document.getElementById('projectile-selection');
    if (projectileSelection) {
        projectileSelection.appendChild(shopButton);
    }
    
    console.log('🛒 Shop button created');
}

function createSettingsButton() {
    // Check if settings button already exists
    if (document.getElementById('settings-button')) {
        return;
    }
    
    // Create settings button
    const settingsButton = document.createElement('button');
    settingsButton.id = 'settings-button';
    settingsButton.className = 'settings-button';
    settingsButton.title = 'Settings & Reset';
    settingsButton.innerHTML = '⚙️';
    
    // Add styles
    settingsButton.style.cssText = `
        position: absolute;
        top: 140px;
        left: 20px;
        width: 50px;
        height: 50px;
        border: none;
        background: linear-gradient(45deg, #9B59B6, #8E44AD);
        border-radius: 50%;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
        z-index: 1000;
    `;
    
    // Add click event listener
    settingsButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('⚙️ Settings button clicked');
        showSettingsModal();
    });
    
    // Add hover effects
    settingsButton.addEventListener('mouseenter', () => {
        settingsButton.style.transform = 'scale(1.1)';
        settingsButton.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.4)';
        playHoverSound();
    });
    
    settingsButton.addEventListener('mouseleave', () => {
        settingsButton.style.transform = 'scale(1)';
        settingsButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    });
    
    // Add to projectile selection screen
    const projectileSelection = document.getElementById('projectile-selection');
    if (projectileSelection) {
        projectileSelection.appendChild(settingsButton);
    }
    
    console.log('⚙️ Settings button created');
}

function createHelpButton() {
    // Check if help button already exists
    if (document.getElementById('help-button')) {
        return;
    }
    
    // Create help button
    const helpButton = document.createElement('button');
    helpButton.id = 'help-button';
    helpButton.className = 'help-button';
    helpButton.title = 'Game Tutorial & Rules';
    helpButton.innerHTML = '❓';
    
    // Add styles
    helpButton.style.cssText = `
        position: absolute;
        top: 200px;
        left: 20px;
        width: 50px;
        height: 50px;
        border: none;
        background: linear-gradient(45deg, #3498DB, #2980B9);
        border-radius: 50%;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
        z-index: 1000;
    `;
    
    // Add click event listener
    helpButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('❓ Help button clicked');
        showHelpModal();
    });
    
    // Add hover effects
    helpButton.addEventListener('mouseenter', () => {
        helpButton.style.transform = 'scale(1.1)';
        helpButton.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.4)';
        playHoverSound();
    });
    
    helpButton.addEventListener('mouseleave', () => {
        helpButton.style.transform = 'scale(1)';
        helpButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    });
    
    // Add to projectile selection screen
    const projectileSelection = document.getElementById('projectile-selection');
    if (projectileSelection) {
        projectileSelection.appendChild(helpButton);
    }
    
    console.log('❓ Help button created');
}

function createCreatorCredit() {
    // Check if creator credit already exists
    if (document.getElementById('creator-credit')) {
        return;
    }
    
    // Create creator credit footer
    const creatorCredit = document.createElement('div');
    creatorCredit.id = 'creator-credit';
    creatorCredit.style.cssText = `
        position: absolute;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.5);
        color: white;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: bold;
        z-index: 10;
    `;
    creatorCredit.textContent = 'Created by R creative Lab';
    
    // Add to projectile selection screen
    const projectileSelection = document.getElementById('projectile-selection');
    if (projectileSelection) {
        projectileSelection.appendChild(creatorCredit);
    }
    
    console.log('👨‍🎨 Creator credit added');
}

function showShopModal() {
    console.log('🛒 Opening weapon shop');
    
    // Remove any existing modal first
    const existingModal = document.getElementById('shop-modal-bg');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }
    
    // Create modal background
    const modalBg = document.createElement('div');
    modalBg.id = 'shop-modal-bg';
    modalBg.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 50000;
        animation: fadeIn 0.3s ease;
    `;
    
    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: linear-gradient(145deg, #2c3e50, #34495e);
        border-radius: 20px;
        padding: 30px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        border: 2px solid #32CD32;
        color: white;
        text-align: center;
        animation: slideIn 0.3s ease;
        position: relative;
        z-index: 50001;
    `;
    
    // Create shop HTML content
    let shopHTML = `
        <h2 style="color: #32CD32; margin-bottom: 20px; font-size: 28px;">
            🍻 Bar Merry-Round 🍻
        </h2>
        <p style="color: #87CEEB; margin-bottom: 20px; font-size: 16px; font-style: italic;">
            "Get the best weapons at the most fun rotating bar!"
        </p>
        <div style="background: rgba(50, 205, 50, 0.1); padding: 15px; border-radius: 10px; margin-bottom: 20px;">
            <h3 style="color: #32CD32; margin: 0;">💰 Your Money: $${playerMoney.toLocaleString()}</h3>
        </div>
        <div style="text-align: left;">
            <h3 style="color: #87CEEB; margin-bottom: 15px;">🔫 Weapon Inventory</h3>
    `;
    
    // 武器ごとの購入ボタンを作成
    Object.entries(projectileTypes).forEach(([weapon, config]) => {
        const isOwned = ownedWeapons.includes(weapon);
        const price = weaponPrices[weapon];
        const canAfford = playerMoney >= price;
        
        shopHTML += `
            <div style="
                background: rgba(255, 255, 255, 0.1);
                margin: 15px 0;
                padding: 15px;
                border-radius: 12px;
                border: ${isOwned ? '2px solid #32CD32' : '2px solid #555'};
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <div>
                        <h4 style="margin: 0; color: ${isOwned ? '#32CD32' : '#fff'};">
                            ${isOwned ? '✅' : '🔒'} ${config.name}
                        </h4>
                        <p style="margin: 5px 0; font-size: 12px; color: #BDC3C7;">
                            Speed: ${config.velocity} | Mass: ${config.mass} | Cooldown: ${config.cooldown}ms
                        </p>
                    </div>
                    <div style="text-align: right;">
                        ${isOwned ? 
                            '<span style="color: #32CD32; font-weight: bold;">Owned</span>' :
                            `<button 
                                data-weapon="${weapon}"
                                class="purchase-button"
                                style="
                                    background: ${canAfford ? 'linear-gradient(45deg, #32CD32, #228B22)' : 'linear-gradient(45deg, #777, #555)'};
                                    color: white;
                                    border: none;
                                    padding: 8px 16px;
                                    border-radius: 8px;
                                    font-weight: bold;
                                    cursor: ${canAfford ? 'pointer' : 'not-allowed'};
                                    font-size: 14px;
                                    ${canAfford ? '' : 'opacity: 0.5;'}
                                "
                                ${canAfford ? '' : 'disabled'}
                            >
                                $${price.toLocaleString()}
                            </button>`
                        }
                    </div>
                </div>
                ${weapon === 'bomb' ? 
                    '<p style="margin: 0; font-size: 11px; color: #FF6B6B;">⚠️ Explodes after 2 seconds, affecting surrounding objects</p>' : 
                    ''
                }
            </div>
        `;
    });
    
    shopHTML += `
        </div>
        <button id="close-shop" style="
            background: linear-gradient(45deg, #e74c3c, #c0392b);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            margin-top: 20px;
            transition: all 0.3s ease;
        ">Close</button>
        
        <div style="
            margin-top: 15px;
            padding: 8px;
            text-align: center;
            font-size: 11px;
            color: #BDC3C7;
            border-top: 1px solid rgba(255,255,255,0.1);
        ">
            Created by <strong>R creative Lab</strong><br>
            <a href="https://R-TARO.com" target="_blank" style="color: #87CEEB; text-decoration: none;">R-TARO.com</a>
        </div>
    `;
    
    modal.innerHTML = shopHTML;
    modalBg.appendChild(modal);
    
    // Add CSS animations
    const style = document.createElement('style');
    style.id = 'shop-modal-style';
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideIn {
            from { transform: translateY(-50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        #close-shop:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
    `;
    document.head.appendChild(style);
    
    // Add purchase button event listeners
    const purchaseButtons = modal.querySelectorAll('.purchase-button');
    purchaseButtons.forEach(button => {
        button.addEventListener('click', () => {
            const weaponType = button.dataset.weapon;
            purchaseWeapon(weaponType);
        });
    });
    
    // Add close functionality
    const closeButton = modal.querySelector('#close-shop');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            console.log('🛒 Closing shop modal');
            if (document.body.contains(modalBg)) {
                document.body.removeChild(modalBg);
            }
            const styleElement = document.getElementById('shop-modal-style');
            if (styleElement && document.head.contains(styleElement)) {
                document.head.removeChild(styleElement);
            }
        });
    }
    
    // Close on background click
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) {
            console.log('🛒 Closing shop modal (background click)');
            if (document.body.contains(modalBg)) {
                document.body.removeChild(modalBg);
            }
            const styleElement = document.getElementById('shop-modal-style');
            if (styleElement && document.head.contains(styleElement)) {
                document.head.removeChild(styleElement);
            }
        }
    });
    
    document.body.appendChild(modalBg);
    console.log('🛒 Shop modal added to DOM');
}

function showSettingsModal() {
    console.log('⚙️ Opening settings modal');
    
    // Remove any existing modal first
    const existingModal = document.getElementById('settings-modal-bg');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }
    
    // Create modal background
    const modalBg = document.createElement('div');
    modalBg.id = 'settings-modal-bg';
    modalBg.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 50000;
        animation: fadeIn 0.3s ease;
    `;
    
    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: linear-gradient(145deg, #2c3e50, #34495e);
        border-radius: 20px;
        padding: 30px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        border: 2px solid #9B59B6;
        color: white;
        text-align: center;
        animation: slideIn 0.3s ease;
        position: relative;
        z-index: 50001;
    `;
    
    // Create settings HTML content
    let settingsHTML = `
        <h2 style="color: #9B59B6; margin-bottom: 20px; font-size: 28px;">
            ⚙️ Settings ⚙️
        </h2>
        
        <div style="background: rgba(155, 89, 182, 0.1); padding: 20px; border-radius: 15px; margin-bottom: 20px;">
            <h3 style="color: #9B59B6; margin-bottom: 15px;">📊 Current Data</h3>
            <div style="text-align: left; margin: 10px 0;">
                <div style="margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 5px;">
                    <span style="color: #FFD700;">💰 Money:</span> 
                    <span style="font-weight: bold;">$${playerMoney.toLocaleString()}</span>
                </div>
                <div style="margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 5px;">
                    <span style="color: #FFD700;">🏆 High Score:</span> 
                    <span style="font-weight: bold;">${getDisplayScore(highestScore)}</span>
                </div>
                <div style="margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 5px;">
                    <span style="color: #87CEEB;">🎮 Games Played:</span> 
                    <span style="font-weight: bold;">${scoreHistory.length} times</span>
                </div>
                <div style="margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 5px;">
                    <span style="color: #90EE90;">🔫 Owned Weapons:</span> 
                    <span style="font-weight: bold;">${ownedWeapons.length}/${Object.keys(projectileTypes).length} weapons</span>
                </div>
            </div>
        </div>
        
        <div style="background: rgba(231, 76, 60, 0.1); padding: 20px; border-radius: 15px; margin-bottom: 20px; border: 2px solid #e74c3c;">
            <h3 style="color: #e74c3c; margin-bottom: 15px;">⚠️ Data Reset</h3>
            <p style="color: #BDC3C7; margin-bottom: 15px; font-size: 14px;">
                Clicking the button below will delete all game data.<br>
                This action cannot be undone.
            </p>
            <button id="reset-data" style="
                background: linear-gradient(45deg, #e74c3c, #c0392b);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 10px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                margin: 5px;
            ">🗑️ Reset All Data</button>
        </div>
        
        <div style="display: flex; justify-content: space-between; gap: 10px;">
            <button id="close-settings" style="
                background: linear-gradient(45deg, #95a5a6, #7f8c8d);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 10px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                flex: 1;
            ">Close</button>
        </div>
        
        <div style="
            margin-top: 15px;
            padding: 8px;
            text-align: center;
            font-size: 11px;
            color: #BDC3C7;
            border-top: 1px solid rgba(255,255,255,0.1);
        ">
            Created by <strong>R creative Lab</strong><br>
            <a href="https://R-TARO.com" target="_blank" style="color: #87CEEB; text-decoration: none;">R-TARO.com</a>
        </div>
    `;
    
    modal.innerHTML = settingsHTML;
    modalBg.appendChild(modal);
    
    // Add CSS animations
    const style = document.createElement('style');
    style.id = 'settings-modal-style';
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideIn {
            from { transform: translateY(-50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        #close-settings:hover, #reset-data:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
    `;
    document.head.appendChild(style);
    
    // Add reset functionality
    const resetButton = modal.querySelector('#reset-data');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            const confirmReset = confirm(
                '⚠️ Are you sure you want to reset all game data?\n\n' +
                'The following data will be deleted:\n' +
                `• Money: $${playerMoney.toLocaleString()}\n` +
                `• High Score: ${getDisplayScore(highestScore)}\n` +
                `• Game History: ${scoreHistory.length} games\n` +
                `• Owned Weapons: ${ownedWeapons.length} weapons\n\n` +
                'This action cannot be undone.'
            );
            
            if (confirmReset) {
                resetAllGameData();
                // Settings modal to close
                if (document.body.contains(modalBg)) {
                    document.body.removeChild(modalBg);
                }
                const styleElement = document.getElementById('settings-modal-style');
                if (styleElement && document.head.contains(styleElement)) {
                    document.head.removeChild(styleElement);
                }
                
                // Show success message and refresh weapon selection
                alert('✅ All game data has been reset to initial state!\nThe game has returned to its original state.');
                
                // Refresh the weapon selection screen
                showProjectileSelection();
            }
        });
    }
    
    // Add close functionality
    const closeButton = modal.querySelector('#close-settings');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            console.log('⚙️ Closing settings modal');
            if (document.body.contains(modalBg)) {
                document.body.removeChild(modalBg);
            }
            const styleElement = document.getElementById('settings-modal-style');
            if (styleElement && document.head.contains(styleElement)) {
                document.head.removeChild(styleElement);
            }
        });
    }
    
    // Close on background click
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) {
            console.log('⚙️ Closing settings modal (background click)');
            if (document.body.contains(modalBg)) {
                document.body.removeChild(modalBg);
            }
            const styleElement = document.getElementById('settings-modal-style');
            if (styleElement && document.head.contains(styleElement)) {
                document.head.removeChild(styleElement);
            }
        }
    });
    
    document.body.appendChild(modalBg);
    console.log('⚙️ Settings modal added to DOM');
}

function resetAllGameData() {
    console.log('🗑️ Resetting all game data...');
    
    // Clear localStorage
    const keysToRemove = [
        'medarion_highest_score',
        'medarion_score_history',
        'medarion_player_money',
        'medarion_owned_weapons',
        'medarion_unlocked_weapons' // Legacy key for backward compatibility
    ];
    
    keysToRemove.forEach(key => {
        localStorage.removeItem(key);
    });
    
    // Reset all variables to initial state
    highestScore = 0;
    scoreHistory = [];
    playerMoney = 0;
    ownedWeapons = ['beer'];
    unlockedWeapons = ['beer'];
    selectedProjectileType = null;
    
    console.log('✅ All game data has been reset to initial state');
}

// グローバル関数として武器購入関数を定義
window.purchaseWeapon = function(weaponType) {
    const price = weaponPrices[weaponType];
    
    if (playerMoney >= price && !ownedWeapons.includes(weaponType)) {
        // 購入処理
        playerMoney -= price;
        ownedWeapons.push(weaponType);
        unlockedWeapons = [...ownedWeapons]; // 表示用も更新
        
        // 購入音を再生
        playSelectSound();
        
        console.log(`🛒 Purchased ${projectileTypes[weaponType].name} for $${price.toLocaleString()}`);
        console.log(`💰 Remaining money: $${playerMoney.toLocaleString()}`);
        
        // データを保存
        saveGameProgress();
        
        // ショップモーダルを閉じる
        const modalBg = document.getElementById('shop-modal-bg');
        if (modalBg && document.body.contains(modalBg)) {
            document.body.removeChild(modalBg);
        }
        
        const shopStyle = document.getElementById('shop-modal-style');
        if (shopStyle && document.head.contains(shopStyle)) {
            document.head.removeChild(shopStyle);
        }
        
        // 武器選択画面を更新（武器選択画面が表示されている場合のみ）
        const projectileSelection = document.getElementById('projectile-selection');
        if (projectileSelection && projectileSelection.style.display !== 'none') {
            // 武器選択画面を再表示して更新
            setTimeout(() => {
                showProjectileSelection();
            }, 100);
        }
        
        // 購入成功メッセージ
        alert(`🎉 ${projectileTypes[weaponType].name} has been purchased!\nRemaining money: $${playerMoney.toLocaleString()}`);
        
    } else if (ownedWeapons.includes(weaponType)) {
        alert('This weapon has already been purchased.');
    } else {
        alert(`Insufficient funds.\nRequired amount: $${price.toLocaleString()}\nCurrent money: $${playerMoney.toLocaleString()}`);
    }
};

function showRankingModal() {
    console.log('🏆 Showing ranking modal');
    
    // Remove any existing modal first
    const existingModal = document.getElementById('ranking-modal-bg');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }
    
    // Create modal background
    const modalBg = document.createElement('div');
    modalBg.id = 'ranking-modal-bg';
    modalBg.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 50000;
        animation: fadeIn 0.3s ease;
    `;
    
    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: linear-gradient(145deg, #2c3e50, #34495e);
        border-radius: 20px;
        padding: 30px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        border: 2px solid #FFD700;
        color: white;
        text-align: center;
        animation: slideIn 0.3s ease;
        position: relative;
        z-index: 50001;
    `;
    
    // Create modal HTML content
    let rankingHTML = `
        <h2 style="color: #FFD700; margin-bottom: 20px; font-size: 28px;">
            🏆 Score Leaderboard 🏆
        </h2>
        <div style="background: rgba(255, 215, 0, 0.1); padding: 15px; border-radius: 10px; margin-bottom: 20px;">
            <h3 style="color: #FFD700; margin: 0;">Highest Score: ${getDisplayScore(highestScore)}</h3>
        </div>
        <div style="background: rgba(50, 205, 50, 0.1); padding: 15px; border-radius: 10px; margin-bottom: 20px;">
            <h3 style="color: #32CD32; margin: 0;">💰 Current Money: $${playerMoney.toLocaleString()}</h3>
        </div>
        <div style="text-align: left;">
            <h3 style="color: #87CEEB; margin-bottom: 15px;">📊 Recent Scores</h3>
    `;
    
    if (scoreHistory.length === 0) {
        rankingHTML += `
            <p style="text-align: center; color: #BDC3C7; font-style: italic;">
                No scores recorded yet<br>
                Play the game and record your score!
            </p>
        `;
    } else {
        rankingHTML += `<div style="max-height: 300px; overflow-y: auto;">`;
        scoreHistory.forEach((entry, index) => {
            const isNewHighScore = entry.score === highestScore;
            const medalIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏆';
            
            rankingHTML += `
                <div style="
                    background: ${isNewHighScore ? 'linear-gradient(45deg, #FFD700, #FFA500)' : 'rgba(255, 255, 255, 0.1)'};
                    margin: 10px 0;
                    padding: 12px;
                    border-radius: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    ${isNewHighScore ? 'border: 2px solid #FFD700; box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);' : ''}
                ">
                    <span style="font-size: 18px;">${medalIcon}</span>
                    <span style="font-weight: bold; color: ${isNewHighScore ? '#000' : '#fff'};">
                        ${getDisplayScore(entry.score)}
                    </span>
                    <span style="font-size: 12px; color: ${isNewHighScore ? '#555' : '#BDC3C7'};">
                        ${entry.date} ${entry.time}
                    </span>
                </div>
            `;
        });
        rankingHTML += `</div>`;
    }
    
    // 武器購入状況
    rankingHTML += `
        <div style="margin-top: 20px; text-align: left;">
            <h3 style="color: #87CEEB; margin-bottom: 15px;">🔫 Weapon Purchase Status</h3>
    `;
    
    Object.entries(projectileTypes).forEach(([weapon, config]) => {
        const isOwned = ownedWeapons.includes(weapon);
        const price = weaponPrices[weapon];
        
        rankingHTML += `
            <div style="
                background: rgba(255, 255, 255, 0.1);
                margin: 8px 0;
                padding: 10px;
                border-radius: 8px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <span style="font-weight: bold;">
                    ${isOwned ? '✅' : '🔒'} ${config.name}
                </span>
                <span style="font-size: 12px; color: #BDC3C7;">
                    ${isOwned ? 'Purchased' : `$${price.toLocaleString()}`}
                </span>
            </div>
        `;
    });
    
    rankingHTML += `
        </div>
        <button id="close-ranking" style="
            background: linear-gradient(45deg, #e74c3c, #c0392b);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            margin-top: 20px;
            transition: all 0.3s ease;
        ">Close</button>
        
        <div style="
            margin-top: 15px;
            padding: 8px;
            text-align: center;
            font-size: 11px;
            color: #BDC3C7;
            border-top: 1px solid rgba(255,255,255,0.1);
        ">
            Created by <strong>R creative Lab</strong><br>
            <a href="https://R-TARO.com" target="_blank" style="color: #87CEEB; text-decoration: none;">R-TARO.com</a>
        </div>
    `;
    
    modal.innerHTML = rankingHTML;
    modalBg.appendChild(modal);
    
    // Add CSS animations
    const style = document.createElement('style');
    style.id = 'ranking-modal-style';
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideIn {
            from { transform: translateY(-50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        #close-ranking:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
    `;
    document.head.appendChild(style);
    
    // Add close functionality - fix the error by using proper DOM query
    const closeButton = modal.querySelector('#close-ranking');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            console.log('🏆 Closing ranking modal');
            if (document.body.contains(modalBg)) {
                document.body.removeChild(modalBg);
            }
            const styleElement = document.getElementById('ranking-modal-style');
            if (styleElement && document.head.contains(styleElement)) {
                document.head.removeChild(styleElement);
            }
        });
    }
    
    // Close on background click
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) {
            console.log('🏆 Closing ranking modal (background click)');
            if (document.body.contains(modalBg)) {
                document.body.removeChild(modalBg);
            }
            const styleElement = document.getElementById('ranking-modal-style');
            if (styleElement && document.head.contains(styleElement)) {
                document.head.removeChild(styleElement);
            }
        }
    });
    
    document.body.appendChild(modalBg);
    console.log('🏆 Ranking modal added to DOM');
}

function checkProjectileImages() {
    const imageConfigs = [
        { className: 'beer', src: 'beerpic.png' },
        { className: 'cocktail', src: 'cocktailpic.png' },
        { className: 'bomb', src: 'bombpic.png' }
    ];
    
    imageConfigs.forEach(config => {
        const img = new Image();
        const iconElement = document.querySelector(`.projectile-icon.${config.className}`);
        
        img.onload = () => {
            // Image loaded successfully, hide emoji fallback
            if (iconElement) {
                iconElement.style.backgroundImage = `url('${config.src}')`;
                console.log(`✅ ${config.className} image loaded successfully`);
            }
        };
        
        img.onerror = () => {
            // Image failed to load, show emoji fallback
            if (iconElement) {
                iconElement.classList.add('error');
                iconElement.style.backgroundImage = 'none';
                console.warn(`⚠️ ${config.className} image failed to load, using emoji fallback`);
            }
        };
        
        img.src = config.src;
    });
}

function hideProjectileSelection() {
    // Stop BGM when hiding selection screen
    stopBGM();
    
    const projectileSelection = document.getElementById('projectile-selection');
    if (projectileSelection) {
        projectileSelection.classList.add('hidden');
        // Immediately hide instead of using setTimeout
        projectileSelection.style.display = 'none';
    }
    
    console.log('🎯 Projectile selection screen hidden');
}

function initLoading() {
    updateLoadingText('Initializing Ammo.js physics engine...');
    updateLoadingProgress(10);
    
    setTimeout(() => {
        init();
    }, 500);
}

function init() {
    updateLoadingText('Initializing graphics environment...');
    updateLoadingProgress(20);
    
    initGraphics();
    
    updateLoadingText('Setting up physics engine...');
    updateLoadingProgress(40);
    
    initPhysics();
    
    updateLoadingText('Loading 3D models...');
    updateLoadingProgress(60);
    
    // 3Dモデル読み込み開始
    isLoadingModels = true;
    createObjects();
    
    updateLoadingText('Initializing input system...');
    updateLoadingProgress(70);
    
    initInput();
    
    // 3Dモデル読み込み完了を待つ
    waitForModelsToLoad();
}

function updateLoadingProgress(percentage) {
    const loadingBar = document.getElementById('loading-bar');
    const loadingPercentage = document.getElementById('loading-percentage');
    
    if (loadingBar) {
        loadingBar.style.width = percentage + '%';
    }
    if (loadingPercentage) {
        loadingPercentage.textContent = percentage + '%';
    }
    
    loadingProgress = percentage;
}

function updateLoadingText(text) {
    const loadingText = document.getElementById('loading-text');
    if (loadingText) {
        loadingText.textContent = text;
    }
            console.log('📦 ' + text);
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
    isGameLoaded = true;
    console.log('🎮 Game loading complete!');
}

function initGraphics() {
    container = document.getElementById('container');

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.2, 2000);
    
    scene = new THREE.Scene();
    
    // テクスチャローダーを先に初期化
    textureLoader = new THREE.TextureLoader();
    gltfLoader = new GLTFLoader();
    
    // 宇宙背景テクスチャを読み込み
    const universeTexture = textureLoader.load(
        'universe.jpg',
        function(texture) {
            console.log('🌌 Universe background texture loaded successfully');
            scene.background = texture;
        },
        function(progress) {
            console.log('🌌 Universe texture loading progress:', (progress.loaded / progress.total * 100) + '%');
        },
        function(error) {
            console.warn('⚠️ Failed to load universe texture, using fallback color:', error);
            scene.background = new THREE.Color(0x000011); // 深い宇宙色をフォールバック
        }
    );

    camera.position.set(0, 3, 14); // 高さ3、z=14から原点方向（より近くに）

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0); // リング中央を狙う
    controls.update();

    const ambientLight = new THREE.AmbientLight(0xbbbbbb);
    scene.add(ambientLight);

    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(-10, 10, 5);
    light.castShadow = true;
    const d = 20;
    light.shadow.camera.left = -d;
    light.shadow.camera.right = d;
    light.shadow.camera.top = d;
    light.shadow.camera.bottom = -d;

    light.shadow.camera.near = 2;
    light.shadow.camera.far = 50;

    light.shadow.mapSize.x = 1024;
    light.shadow.mapSize.y = 1024;

    scene.add(light);

    window.addEventListener('resize', onWindowResize);
}

function initPhysics() {
    // 通常のリジッドボディ用の物理設定
    const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
    const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
    const broadphase = new Ammo.btDbvtBroadphase();
    const solver = new Ammo.btSequentialImpulseConstraintSolver();
    physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfiguration);
    physicsWorld.setGravity(new Ammo.btVector3(0, gravityConstant, 0));

    transformAux1 = new Ammo.btTransform();
}

function createObjects() {
    // ドーナツ型ステージを作成
    createDonutStage();
    
    // ドーナツの上にボックスを配置
    createBoxesOnDonut();
    
    // ドーナツ型の地面を作成（穴付き）
    createDonutGround();
    
    // 中央の穴の底を魅力的な虹色に！
    createAttractiveHoleBottom();
    
    // 下に落下検出用の地面を作成（見えない）
    pos.set(0, -20, 0);
    quat.set(0, 0, 0, 1);
    const fallDetectionGround = createParalellepiped(100, 1, 100, 0, pos, quat, new THREE.MeshPhongMaterial({ 
        color: 0xFFFFFF, 
        transparent: true, 
        opacity: 0.1 
    }));
}

function createDonutStage() {
    // レッドカーペット風の豪華なリング形状を作成
    const ringGeometry = new THREE.RingGeometry(donutTubeRadius, donutRadius, 32);
    const ringMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xDC143C, // クリムゾンレッド（レッドカーペット風）
        shininess: 200,
        side: THREE.DoubleSide,
        emissive: 0x330000 // 微かな赤い光沢
    });
    
    donutStage = new THREE.Mesh(ringGeometry, ringMaterial);
    donutStage.position.set(0, 0.3, 0); // 地面から少し上に配置してZ-fightingを避ける
    donutStage.rotation.x = -Math.PI / 2; // 90度回転させて水平に配置
    donutStage.castShadow = true;
    donutStage.receiveShadow = true;
    scene.add(donutStage);

    // リングの物理ボディを作成（複数のボックスで近似）
    createDonutPhysics();
}

function createDonutGround() {
    // ドーナツ型の地面を作成（中央に穴が開いている）
    const ringGroundGeometry = new THREE.RingGeometry(donutTubeRadius, donutRadius + 3, 32);
    
    // アルミプレートテクスチャを読み込み（フォールバック付き）
    let aluminumTexture;
    
    try {
        aluminumTexture = textureLoader.load(
            'almi.png',
            function(texture) {
                console.log('🔧 アルミプレートテクスチャ読み込み成功');
                // テクスチャの設定
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(8, 8); // 8x8でタイリング
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
            },
            function(progress) {
                console.log('テクスチャ読み込み進行:', (progress.loaded / progress.total * 100) + '%');
            },
            function(error) {
                console.warn('アルミプレートテクスチャの読み込みに失敗、プログラム生成テクスチャを使用:', error);
                // フォールバック：プログラム生成テクスチャを使用
                setTimeout(() => {
                    if (window.groundMesh && window.groundMesh.material) {
                        const fallbackTexture = createAluminumPlateTexture();
                        fallbackTexture.wrapS = THREE.RepeatWrapping;
                        fallbackTexture.wrapT = THREE.RepeatWrapping;
                        fallbackTexture.repeat.set(6, 6);
                        window.groundMesh.material.map = fallbackTexture;
                        window.groundMesh.material.needsUpdate = true;
                        console.log('🔧 フォールバックテクスチャを適用しました');
                    }
                }, 100);
            }
        );
    } catch (error) {
        console.warn('テクスチャローダーエラー、プログラム生成テクスチャを使用:', error);
        aluminumTexture = createAluminumPlateTexture();
    }
    
    // テクスチャの設定（読み込み前でも設定）
    if (aluminumTexture) {
        aluminumTexture.wrapS = THREE.RepeatWrapping;
        aluminumTexture.wrapT = THREE.RepeatWrapping;
        aluminumTexture.repeat.set(8, 8); // 8x8でタイリング
    }
    
    // アルミプレート風マテリアル
    const ringGroundMaterial = new THREE.MeshPhongMaterial({ 
        map: aluminumTexture,
        color: 0xC0C0C0, // アルミ色
        shininess: 120,
        specular: 0x404040, // スペキュラーハイライト
        side: THREE.DoubleSide,
        transparent: false
    });
    
    const ringGround = new THREE.Mesh(ringGroundGeometry, ringGroundMaterial);
    ringGround.position.set(0, -0.5, 0);
    ringGround.rotation.x = -Math.PI / 2; // 水平に配置
    ringGround.castShadow = false;
    ringGround.receiveShadow = true;
    scene.add(ringGround);
    
    // フォールバック用にグローバル変数として保存
    window.groundMesh = ringGround;
    
    // 穴の縁を光らせるリングを追加
    createGlowingHoleRing();
    
    console.log('🔧 Created aluminum plate style ground');
}

function createAluminumPlateTexture() {
    // プログラムでアルミプレートパターンを生成
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    
    // ベースのアルミ色
    context.fillStyle = '#B8B8B8';
    context.fillRect(0, 0, 256, 256);
    
    // ダイヤモンドプレートパターンを描画
    const diamondSize = 32;
    const diamondSpacing = diamondSize;
    
    for (let x = 0; x < 256; x += diamondSpacing) {
        for (let y = 0; y < 256; y += diamondSpacing) {
            // ダイヤモンド形状を描画
            context.beginPath();
            context.moveTo(x + diamondSize/2, y);
            context.lineTo(x + diamondSize, y + diamondSize/2);
            context.lineTo(x + diamondSize/2, y + diamondSize);
            context.lineTo(x, y + diamondSize/2);
            context.closePath();
            
            // グラデーション効果
            const gradient = context.createRadialGradient(
                x + diamondSize/2, y + diamondSize/2, 0,
                x + diamondSize/2, y + diamondSize/2, diamondSize/2
            );
            gradient.addColorStop(0, '#E0E0E0');
            gradient.addColorStop(0.7, '#C0C0C0');
            gradient.addColorStop(1, '#A0A0A0');
            
            context.fillStyle = gradient;
            context.fill();
            
            // 縁取り
            context.strokeStyle = '#808080';
            context.lineWidth = 1;
            context.stroke();
        }
    }
    
    // ランダムな傷や汚れを追加
    for (let i = 0; i < 20; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const length = Math.random() * 40 + 10;
        const angle = Math.random() * Math.PI * 2;
        
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        context.strokeStyle = `rgba(${128 + Math.random() * 64}, ${128 + Math.random() * 64}, ${128 + Math.random() * 64}, 0.3)`;
        context.lineWidth = Math.random() * 2 + 0.5;
        context.stroke();
    }
    
    return new THREE.CanvasTexture(canvas);
}

function createGlowingHoleRing() {
    // 穴の縁を光らせる虹色リング
    const glowRingGeometry = new THREE.RingGeometry(donutTubeRadius - 0.2, donutTubeRadius + 0.2, 32);
    
    // 虹色グラデーションマテリアル
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    
    // 虹色グラデーション作成
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, '#FF0080'); // ピンク
    gradient.addColorStop(0.2, '#FF8000'); // オレンジ
    gradient.addColorStop(0.4, '#FFFF00'); // 黄色
    gradient.addColorStop(0.6, '#80FF00'); // ライムグリーン
    gradient.addColorStop(0.8, '#00FFFF'); // シアン
    gradient.addColorStop(1, '#8000FF'); // 紫
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    
    const glowTexture = new THREE.CanvasTexture(canvas);
    const glowMaterial = new THREE.MeshBasicMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
    });
    
    const glowRing = new THREE.Mesh(glowRingGeometry, glowMaterial);
    glowRing.position.set(0, 0.1, 0); // 地面より少し上
    glowRing.rotation.x = -Math.PI / 2;
    scene.add(glowRing);
    
    // アニメーション用にグローバル変数に保存
    window.glowRing = glowRing;
}

function createAttractiveHoleBottom() {
    // 魅力的な虹色の穴底を作成
    const holeBottomGeometry = new THREE.CircleGeometry(donutTubeRadius, 32);
    
    // キラキラ光る虹色マテリアル
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    
    // 中心から外側への虹色グラデーション
    const gradient = context.createRadialGradient(256, 256, 0, 256, 256, 256);
    gradient.addColorStop(0, '#FFFFFF'); // 白い中心
    gradient.addColorStop(0.1, '#FFD700'); // ゴールド
    gradient.addColorStop(0.3, '#FF69B4'); // ホットピンク
    gradient.addColorStop(0.5, '#00BFFF'); // ディープスカイブルー
    gradient.addColorStop(0.7, '#32CD32'); // ライムグリーン
    gradient.addColorStop(0.9, '#FF4500'); // オレンジレッド
    gradient.addColorStop(1, '#8A2BE2'); // ブルーバイオレット
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    
    // キラキラ効果を追加
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = Math.random() * 8 + 2;
        
        context.fillStyle = 'rgba(255, 255, 255, 0.8)';
        context.beginPath();
        context.arc(x, y, size, 0, Math.PI * 2);
        context.fill();
    }
    
    const holeTexture = new THREE.CanvasTexture(canvas);
    const holeMaterial = new THREE.MeshBasicMaterial({
        map: holeTexture,
        transparent: true,
        opacity: 0.9
    });
    
    const holeBottom = new THREE.Mesh(holeBottomGeometry, holeMaterial);
    holeBottom.position.set(0, -2.8, 0); // 穴の底
    holeBottom.rotation.x = -Math.PI / 2;
    scene.add(holeBottom);
    
    // 物理ボディも追加
    pos.set(0, -3, 0);
    quat.set(0, 0, 0, 1);
    const holeGround = createParalellepiped(donutTubeRadius * 2, 1, donutTubeRadius * 2, 0, pos, quat, new THREE.MeshPhongMaterial({ 
        color: 0x654321, 
        transparent: true,
        opacity: 0 // 見えないようにする
    }));
    holeGround.castShadow = false;
    holeGround.receiveShadow = false;
    
    // アニメーション用にグローバル変数に保存
    window.holeBottom = holeBottom;
    
    // パルス効果のための光源追加
    const holeLight = new THREE.PointLight(0xFF69B4, 2, 10);
    holeLight.position.set(0, -1, 0);
    scene.add(holeLight);
    window.holeLight = holeLight;
}

function animateHole() {
    const time = performance.now() * 0.002; // 時間ベースのアニメーション
    
    // 穴の縁のリングを回転＆パルス
    if (window.glowRing) {
        window.glowRing.rotation.z = time * 2; // 回転
        window.glowRing.material.opacity = 0.6 + Math.sin(time * 3) * 0.3; // パルス効果
    }
    
    // 穴底のキラキラ効果
    if (window.holeBottom) {
        window.holeBottom.rotation.z = -time * 1.5; // 逆回転
        window.holeBottom.material.opacity = 0.8 + Math.sin(time * 4) * 0.2; // パルス効果
    }
    
    // 光源のパルス効果
    if (window.holeLight) {
        window.holeLight.intensity = 2 + Math.sin(time * 5) * 1; // 強く脈動
        // 色も変化させる
        const hue = (time * 50) % 360;
        window.holeLight.color.setHSL(hue / 360, 1, 0.5);
    }
}

function createDonutPhysics() {
    // 茶色のリングステージに物理判定を追加
    const ringInnerRadius = donutTubeRadius;
    const ringOuterRadius = donutRadius;
    const segments = 16; // リングを16セグメントで分割
    
    for (let i = 0; i < segments; i++) {
        const angle1 = (i / segments) * Math.PI * 2;
        const angle2 = ((i + 1) / segments) * Math.PI * 2;
        
        // セグメントごとに台形状のボックスを作成
        const midAngle = (angle1 + angle2) / 2;
        const segmentWidth = ringOuterRadius - ringInnerRadius;
        const segmentDepth = (2 * Math.PI * ((ringInnerRadius + ringOuterRadius) / 2)) / segments;
        
        const x = Math.cos(midAngle) * ((ringInnerRadius + ringOuterRadius) / 2);
        const z = Math.sin(midAngle) * ((ringInnerRadius + ringOuterRadius) / 2);
        
        pos.set(x, 0.25, z); // 茶色リングの高さに合わせる（Y=0.3-0.05）
        quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), midAngle);
        
        // 物理ボディを作成
        const shape = new Ammo.btBoxShape(new Ammo.btVector3(
            segmentWidth * 0.5,
            0.1, // 薄い厚み
            segmentDepth * 0.5
        ));
        shape.setMargin(margin);
        
        // 見えない物理ボディを作成
        const dummyGeometry = new THREE.BoxGeometry(1, 1, 1);
        const dummyMaterial = new THREE.MeshBasicMaterial({ 
            transparent: true, 
            opacity: 0 
        });
        const dummyMesh = new THREE.Mesh(dummyGeometry, dummyMaterial);
        
        const ringBody = createRigidBody(dummyMesh, shape, 0, pos, quat);
        dummyMesh.visible = false; // 完全に見えなくする
        
        donutPhysicsBodies.push(ringBody);
    }
    
    console.log('🍩 Added physics collision to brown ring stage');
}



function createBoxesOnDonut() {
    const boxMass = 1;
    const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xfeca57, 0xe74c3c, 0x9b59b6, 0x3498db, 0x2ecc71, 0xf39c12];
    const boxSize = 0.7;
    
    // メリーゴーラウンドのようにリング状にオブジェクトを配置（積み上げ式）
    const ringPositions = 12; // リング上の配置位置数
    const stackHeight = 3; // 各位置での積み上げ高さ（処理軽量化のため3に減少）
    const ringRadiusStep = (donutRadius - donutTubeRadius) / 3; // リング間の間隔
    
    // 多様なオブジェクトタイプとポイント設定（ポイント高=重量大）
    const objectTypes = [
        { type: 'box', weight: 50, points: 1, mass: 1 },               // BOX: 1ポイント（軽い）
        { type: 'halloween1', weight: 10, points: 15, mass: 5 },       // ハロウィン1: 15ポイント（重め）
        { type: 'halloween2', weight: 10, points: 15, mass: 5 },       // ハロウィン2: 15ポイント（重め）
        { type: 'car', weight: 8, points: 10, mass: 4 },               // 車: 10ポイント（やや重）
        { type: 'car2', weight: 8, points: 10, mass: 6 },              // 車2(赤): 10ポイント（重い）
        { type: 'devil', weight: 4, points: -50, mass: 3 },            // 悪魔: -50ポイント（軽めで動きやすい=罠）
        { type: 'fighter', weight: 6, points: 20, mass: 6 },           // ファイター: 20ポイント（重い）
        { type: 'king', weight: 4, points: 30, mass: 8 }               // キング: 30ポイント（最重量）
    ];
    
    // 重み付きランダム選択関数
    function getWeightedRandomType() {
        const totalWeight = objectTypes.reduce((sum, obj) => sum + obj.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const objType of objectTypes) {
            random -= objType.weight;
            if (random <= 0) {
                return objType;
            }
        }
        return objectTypes[0]; // フォールバック
    }

    for (let ringLayer = 0; ringLayer < 2; ringLayer++) {
        const ringRadius = donutTubeRadius + ringRadiusStep * (ringLayer + 1);
        
        for (let i = 0; i < ringPositions; i++) {
            const angle = (i / ringPositions) * Math.PI * 2 + (ringLayer * 0.3);
            
            // 各位置でオブジェクトを積み上げ
            for (let stackLevel = 0; stackLevel < stackHeight; stackLevel++) {
                const x = Math.cos(angle) * ringRadius;
                const y = Math.sin(angle) * ringRadius;
                const height = boxSize * 0.5 + 0.3 + (stackLevel * boxSize); // 積み上げ高さ
                
                pos.set(x, height, y);
                quat.set(0, 0, 0, 1);
                
                // 重み付きランダム選択でオブジェクトタイプを決定
                const selectedType = getWeightedRandomType();
                
                if (selectedType.type === 'box') {
                    // 通常のボックス
                    const randomColor = colors[Math.floor(Math.random() * colors.length)];
                    const box = createParalellepiped(boxSize, boxSize, boxSize, selectedType.mass, pos, quat, 
                        new THREE.MeshPhongMaterial({ color: randomColor }));
                    box.castShadow = true;
                    box.receiveShadow = true;
                    box.userData.points = selectedType.points;
                    box.userData.objectType = selectedType.type;
                    
                    // メリーゴーラウンド用にボックスの初期位置を記録
                    boxesOnRing.push({
                        mesh: box,
                        body: box.userData.physicsBody,
                        initialAngle: angle,
                        radius: ringRadius,
                        height: height + 0.3,
                        isAttachedToRing: true,
                        lastHitTime: 0
                    });
                } else {
                    // 3Dモデルを配置
                    loadTargetModel(selectedType.type, pos, angle, ringRadius, height + 0.3, selectedType.mass, selectedType.points);
                }
            }
        }
    }
    
    // 中心に近い場所にもオブジェクトを配置
    for (let i = 0; i < 10; i++) { // 処理軽量化のため10個に削減
        const angle = (i / 10) * Math.PI * 2;
        const radius = donutTubeRadius + 1; // 中心寄りに配置
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        pos.set(x, boxSize * 0.5 + 0.6, y);
        quat.set(0, 0, 0, 1);
        
        // 重み付きランダム選択でオブジェクトタイプを決定
        const selectedType = getWeightedRandomType();
        
        if (selectedType.type === 'box') {
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            const box = createParalellepiped(boxSize, boxSize, boxSize, selectedType.mass, pos, quat, 
                new THREE.MeshPhongMaterial({ color: randomColor }));
            box.castShadow = true;
            box.receiveShadow = true;
            box.userData.points = selectedType.points;
            box.userData.objectType = selectedType.type;
            
            boxesOnRing.push({
                mesh: box,
                body: box.userData.physicsBody,
                initialAngle: angle,
                radius: radius,
                height: boxSize * 0.5 + 0.6,
                isAttachedToRing: true,
                lastHitTime: 0
            });
        } else {
            // 3Dモデルを配置
            loadTargetModel(selectedType.type, pos, angle, radius, boxSize * 0.5 + 0.6, selectedType.mass, selectedType.points);
        }
    }
}

function createParalellepiped(sx, sy, sz, mass, pos, quat, material) {
    const threeObject = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz, 1, 1, 1), material);
    const shape = new Ammo.btBoxShape(new Ammo.btVector3(sx * 0.5, sy * 0.5, sz * 0.5));
    shape.setMargin(margin);

    createRigidBody(threeObject, shape, mass, pos, quat);

    return threeObject;
}

function createRigidBody(threeObject, physicsShape, mass, pos, quat) {
    threeObject.position.copy(pos);
    threeObject.quaternion.copy(quat);

    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
    const motionState = new Ammo.btDefaultMotionState(transform);

    const localInertia = new Ammo.btVector3(0, 0, 0);
    physicsShape.calculateLocalInertia(mass, localInertia);

    const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, physicsShape, localInertia);
    const body = new Ammo.btRigidBody(rbInfo);

    threeObject.userData.physicsBody = body;

    scene.add(threeObject);

    if (mass > 0) {
        rigidBodies.push(threeObject);
        body.setActivationState(4);
    }

    physicsWorld.addRigidBody(body);

    return body;
}

function initInput() {
    window.addEventListener('pointerdown', function(event) {
        // ゲームが読み込まれてからのみ操作を受け付ける
        if (!isGameLoaded || !clickRequest) {
            if (isGameLoaded) {
                mouseCoords.set(
                    (event.clientX / window.innerWidth) * 2 - 1,
                    -(event.clientY / window.innerHeight) * 2 + 1
                );
                clickRequest = true;
            }
        }
    });
}

function processClick() {
    if (clickRequest && selectedProjectileType) {
        const currentTime = performance.now();
        const projectileConfig = projectileTypes[selectedProjectileType];
        
        // クールダウンチェック
        if (currentTime - lastShotTime < projectileConfig.cooldown) {
            clickRequest = false;
            return;
        }
        
        // 球の総数制限（メモリ管理）
        const ballCount = rigidBodies.filter(obj => obj.userData.isBall).length;
        if (ballCount >= 10) {
            console.log('⚪ Maximum projectiles reached. Wait for existing ones to be removed.');
            clickRequest = false;
            return;
        }
        
        raycaster.setFromCamera(mouseCoords, camera);

        // 選択された球タイプに応じて発射
        const projectilePos = raycaster.ray.origin.clone().add(raycaster.ray.direction);
        const velocity = raycaster.ray.direction.clone().multiplyScalar(projectileConfig.velocity);
        
        loadSelectedProjectile(projectilePos, velocity, projectileConfig);

        lastShotTime = currentTime;
        clickRequest = false;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    render();
}

function render() {
    const deltaTime = clock.getDelta();
    updatePhysics(deltaTime);
    updateGameTimer();
    processClick();
    renderer.render(scene, camera);
}

function updatePhysics(deltaTime) {
    physicsWorld.stepSimulation(deltaTime, 10);

    // 穴を魅力的にアニメーション
    animateHole();

    // ドーナツステージを回転寿司のように水平回転させる
    if (donutStage) {
        donutStage.rotation.z += donutRotationSpeed * deltaTime;
        
        // 物理ボディの回転は削除しました（透明な壁を削除したため）
        
                // メリーゴーラウンドのようにボックスも一緒に回転させる
        const currentTime = performance.now();
        boxesOnRing.forEach((boxInfo, index) => {
            if (boxInfo.body && !boxInfo.mesh.userData.hasFallen) {
                // 衝突検出：ボックスの速度をチェック
                const velocity = boxInfo.body.getLinearVelocity();
                const velocityMagnitude = Math.sqrt(velocity.x() * velocity.x() + velocity.y() * velocity.y() + velocity.z() * velocity.z());
                
                // 速度が一定以上の場合、何かに当たったと判定
                if (velocityMagnitude > 2.0 && boxInfo.isAttachedToRing) {
                    console.log('📦 Box collision detected! Releasing from ring');
                    
                    // ヒット効果音を再生
                    playHitSound();
                    
                    boxInfo.isAttachedToRing = false;
                    boxInfo.lastHitTime = currentTime;
                }
                
                // リングに固定されている場合のみ強制回転
                if (boxInfo.isAttachedToRing) {
                    const rotationAngle = boxInfo.initialAngle + donutStage.rotation.z;
                    const x = Math.cos(rotationAngle) * boxInfo.radius;
                    const y = Math.sin(rotationAngle) * boxInfo.radius;
                    
                    // 既存のtransformオブジェクトを再利用してメモリリークを防ぐ
                    if (!boxInfo.transform) {
                        boxInfo.transform = new Ammo.btTransform();
                    }
                    boxInfo.transform.setIdentity();
                    boxInfo.transform.setOrigin(new Ammo.btVector3(x, boxInfo.height, y));
                    boxInfo.transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
                    boxInfo.body.getMotionState().setWorldTransform(boxInfo.transform);
                    boxInfo.body.setWorldTransform(boxInfo.transform);
                    boxInfo.body.activate();
                    
                    // 線形速度をリセットして回転に追従させる
                    boxInfo.body.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
                    boxInfo.body.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
                }
                // 解放されたボックスが安定したら再度固定する（オプション）
                else if (currentTime - boxInfo.lastHitTime > 3000 && velocityMagnitude < 0.5) {
                    // 3秒後に速度が低下したら再度リングに固定
                    const currentPos = boxInfo.body.getWorldTransform().getOrigin();
                    const distanceFromCenter = Math.sqrt(currentPos.x() * currentPos.x() + currentPos.z() * currentPos.z());
                    
                    // リング上にまだある場合は再固定
                    if (distanceFromCenter > donutTubeRadius && distanceFromCenter < donutRadius && currentPos.y() > -1) {
                        boxInfo.isAttachedToRing = true;
                        console.log('📦 Re-attached box to ring');
                    }
                }
            }
        });
    }

    // リジッドボディの更新とブロック落下チェック
    for (let i = rigidBodies.length - 1; i >= 0; i--) {
        const objThree = rigidBodies[i];
        const objPhys = objThree.userData.physicsBody;
        const ms = objPhys.getMotionState();
        if (ms) {
            ms.getWorldTransform(transformAux1);
            const p = transformAux1.getOrigin();
            const q = transformAux1.getRotation();
            objThree.position.set(p.x(), p.y(), p.z());
            objThree.quaternion.set(q.x(), q.y(), q.z(), q.w());

            // 球のスタック検出と自動削除
            if (objThree.userData.isBall) {
                const currentTime = performance.now();
                const velocity = objPhys.getLinearVelocity();
                const velocityMagnitude = Math.sqrt(velocity.x() * velocity.x() + velocity.y() * velocity.y() + velocity.z() * velocity.z());
                const distanceFromCenter = Math.sqrt(p.x() * p.x() + p.z() * p.z());
                
                // 爆弾の爆発チェック
                if (objThree.userData.isExplosive && currentTime >= objThree.userData.explosionTime) {
                    console.log('💥 Bomb exploding!');
                    createExplosion(objThree.position, objThree.userData.explosionRadius);
                    
                    // 爆弾を削除
                    scene.remove(objThree);
                    physicsWorld.removeRigidBody(objPhys);
                    
                    if (objThree.userData.physicsBody) {
                        Ammo.destroy(objThree.userData.physicsBody);
                    }
                    
                    rigidBodies.splice(i, 1);
                    continue;
                }
                
                // 球を3秒で自動削除（爆弾以外）
                if (!objThree.userData.isExplosive && currentTime - objThree.userData.creationTime > 3000) {
                    console.log('⚪ Removing projectile (3 seconds elapsed)');
                    scene.remove(objThree);
                    physicsWorld.removeRigidBody(objPhys);
                    
                    // Ammo.jsオブジェクトを適切に削除
                    if (objThree.userData.physicsBody) {
                        Ammo.destroy(objThree.userData.physicsBody);
                    }
                    
                    rigidBodies.splice(i, 1);
                    continue;
                }
            }

            // オブジェクトがドーナツの中央の穴に落ちたかチェック（水平面での距離）
            const distanceFromCenter = Math.sqrt(p.x() * p.x() + p.z() * p.z());
            // donutTubeRadiusより小さい範囲が穴の領域
            if (distanceFromCenter <= donutTubeRadius && p.y() < -1 && !objThree.userData.hasFallen) {
                objThree.userData.hasFallen = true;
                
                // ゲーム中のみスコア計算
                if (isGameActive) {
                    const points = objThree.userData.points || 1;
                    const objectType = objThree.userData.objectType || 'unknown';
                    score += points;
                    
                    // ポイント別のログとエフェクト
                    if (points < 0) {
                        // マイナスアイテム専用効果音を再生
                        playBadSound();
                        
                        console.log(`😈 ${objectType} fell into the hole! ${points} points penalty! Total score: ${score}`);
                        createNegativeEffect(); // 減点エフェクト
                    } else {
                        // 通常の獲得効果音を再生
                        playGetSound();
                        
                        console.log(`🎯 ${objectType} fell into the hole! +${points} points! Total score: ${score}`);
                        createHoleSuccessEffect(); // 通常の成功エフェクト
                    }
                    
                    // UIを更新
                    updateUI();
                }

                // boxesOnRingからも削除
                const boxIndex = boxesOnRing.findIndex(boxInfo => boxInfo.mesh === objThree);
                if (boxIndex !== -1) {
                    boxesOnRing.splice(boxIndex, 1);
                }

                // 落ちたオブジェクトをシーンから削除
                scene.remove(objThree);
                physicsWorld.removeRigidBody(objPhys);
                
                // Ammo.jsオブジェクトを適切に削除
                if (objThree.userData.physicsBody) {
                    Ammo.destroy(objThree.userData.physicsBody);
                }
                
                rigidBodies.splice(i, 1);
            }
            // 通常の落下もチェック（ステージから完全に落ちた場合）
            else if (p.y() < -15 && !objThree.userData.hasFallen) {
                objThree.userData.hasFallen = true;
                console.log('📦 Box fell off the stage');
                
                // boxesOnRingからも削除
                const boxIndex = boxesOnRing.findIndex(boxInfo => boxInfo.mesh === objThree);
                if (boxIndex !== -1) {
                    boxesOnRing.splice(boxIndex, 1);
                }
                
                // 落ちたオブジェクトをシーンから削除
                scene.remove(objThree);
                physicsWorld.removeRigidBody(objPhys);
                
                // Ammo.jsオブジェクトを適切に削除
                if (objThree.userData.physicsBody) {
                    Ammo.destroy(objThree.userData.physicsBody);
                }
                
                rigidBodies.splice(i, 1);
            }
        }
    }
}

function createNegativeEffect() {
    // 悪魔を落とした時の恐ろしいエフェクト
    if (window.holeLight) {
        // 光を暗赤色にして点滅させる
        const originalColor = window.holeLight.color.clone();
        const originalIntensity = window.holeLight.intensity;
        
        window.holeLight.color.setHex(0x8B0000); // ダークレッド
        window.holeLight.intensity = 8;
        
        // 不気味な点滅
        let blinkCount = 0;
        const blinkInterval = setInterval(() => {
            window.holeLight.intensity = window.holeLight.intensity === 8 ? 2 : 8;
            blinkCount++;
            if (blinkCount >= 6) {
                clearInterval(blinkInterval);
                window.holeLight.color.copy(originalColor);
                window.holeLight.intensity = originalIntensity;
            }
        }, 150);
    }
    
    // 穴の縁リングを赤く光らせる
    if (window.glowRing) {
        const originalOpacity = window.glowRing.material.opacity;
        window.glowRing.material.opacity = 1;
        window.glowRing.material.color.setHex(0xFF0000); // 赤
        
        // 元に戻す
        setTimeout(() => {
            window.glowRing.material.color.setHex(0xFFFFFF); // 白に戻す
            window.glowRing.material.opacity = originalOpacity;
        }, 1000);
    }
    
    // 暗いパーティクル効果
    for (let i = 0; i < 6; i++) {
        setTimeout(() => {
            const darkParticle = new THREE.Mesh(
                new THREE.SphereGeometry(0.15, 8, 8),
                new THREE.MeshBasicMaterial({
                    color: 0x8B0000, // ダークレッド
                    transparent: true,
                    opacity: 0.8
                })
            );
            
            darkParticle.position.set(
                (Math.random() - 0.5) * donutTubeRadius * 2,
                Math.random() * 1.5,
                (Math.random() - 0.5) * donutTubeRadius * 2
            );
            
            scene.add(darkParticle);
            
            // パーティクルを下に向かってアニメーション
            const animateDarkParticle = () => {
                darkParticle.position.y -= 0.05;
                darkParticle.material.opacity -= 0.015;
                darkParticle.scale.multiplyScalar(1.01);
                
                if (darkParticle.material.opacity > 0 && darkParticle.position.y > -2) {
                    requestAnimationFrame(animateDarkParticle);
                } else {
                    scene.remove(darkParticle);
                }
            };
            animateDarkParticle();
        }, i * 100);
    }
}

function createHoleSuccessEffect() {
    // 穴に入った時の爆発的な光エフェクト
    if (window.holeLight) {
        // 光を一瞬強くする
        const originalIntensity = window.holeLight.intensity;
        window.holeLight.intensity = 10;
        window.holeLight.color.setHex(0xFFD700); // ゴールド
        
        // 元に戻す
        setTimeout(() => {
            window.holeLight.intensity = originalIntensity;
        }, 200);
    }
    
    // 穴の縁リングを一瞬大きくする
    if (window.glowRing) {
        const originalScale = window.glowRing.scale.x;
        window.glowRing.scale.set(1.5, 1.5, 1.5);
        window.glowRing.material.opacity = 1;
        
        // 元に戻す
        setTimeout(() => {
            window.glowRing.scale.set(originalScale, originalScale, originalScale);
        }, 300);
    }
    
    // キラキラパーティクル効果
    for (let i = 0; i < 8; i++) {
        setTimeout(() => {
            const sparkle = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 8, 8),
                new THREE.MeshBasicMaterial({
                    color: new THREE.Color().setHSL(Math.random(), 1, 0.8),
                    transparent: true,
                    opacity: 1
                })
            );
            
            sparkle.position.set(
                (Math.random() - 0.5) * donutTubeRadius * 2,
                Math.random() * 2,
                (Math.random() - 0.5) * donutTubeRadius * 2
            );
            
            scene.add(sparkle);
            
            // パーティクルをアニメーション
            const startY = sparkle.position.y;
            const animateSparkle = () => {
                sparkle.position.y += 0.1;
                sparkle.material.opacity -= 0.02;
                sparkle.scale.multiplyScalar(1.02);
                
                if (sparkle.material.opacity > 0) {
                    requestAnimationFrame(animateSparkle);
                } else {
                    scene.remove(sparkle);
                }
            };
            animateSparkle();
        }, i * 50);
    }
}

function createSphere(radius, mass, pos, quat, material) {
    const threeObject = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 16), material);
    const shape = new Ammo.btSphereShape(radius);
    shape.setMargin(margin);

    createRigidBody(threeObject, shape, mass, pos, quat);

    return threeObject;
}



function startGame() {
    score = 0;
    gameStartTime = performance.now();
    isGameActive = true;
    lastResultTime = 0;
    isShowingResult = false;
    isShowingCountdown = false;
    lastCountdownNumber = -1;
    
    // ゲーム開始時の所持金を記録（リールアニメーション用）
    gameStartMoney = playerMoney;
    
    // 報酬フラグをリセット（新しいゲーム開始時）
    window.gameRewardClaimed = false;
    
    // ゲームBGMを開始
    startGameBGM();
    
    // カウントダウン表示を隠す
    const countdownDisplay = document.getElementById('countdown-display');
    if (countdownDisplay) {
        countdownDisplay.style.display = 'none';
    }
    
    console.log('🎮 Game Started! Aim for high score within 15 seconds!');
    console.log('🎬 Grand finale results show will begin in 15 seconds!');
    console.log('📝 Points: BOX=1pt, Car=10pt, Halloween=15pt, Fighter=20pt, King=30pt');
    console.log('⚖️ Weight System: Higher points = heavier objects! Be strategic!');
    console.log('⚠️ Warning: Devil😈 = -50 points! (But light and easy to move - it\'s a trap!)');
    console.log(`🎯 Using ${projectileTypes[selectedProjectileType].name} projectiles`);
    updateUI();
}

function updateGameTimer() {
    if (!isGameActive || !gameStartTime) return;
    
    const currentTime = performance.now();
    const elapsedTime = (currentTime - gameStartTime) / 1000; // 秒に変換
    const remainingTime = Math.max(0, gameTime - elapsedTime);
    
    // 残り5秒からカウントダウン表示
    if (remainingTime <= 5.5 && remainingTime > 0.1) {
        const countdownNumber = Math.ceil(remainingTime);
        if (countdownNumber <= 5) {
            showCountdown(countdownNumber);
        }
    } else if (remainingTime <= 0.1 && !isShowingResult) {
        showTimeUp();
        return;
    }
    
    if (!isShowingResult) {
        updateUI();
    }
}

function showCountdown(number) {
    // 同じ数字の重複表示を防ぐ
    if (lastCountdownNumber === number) {
        return;
    }
    
    const countdownDisplay = document.getElementById('countdown-display');
    const countdownNumber = document.getElementById('countdown-number');
    const countdownText = document.getElementById('countdown-text');
    
    if (!countdownDisplay || !countdownNumber || !countdownText) {
        console.error('Countdown elements not found');
        return;
    }
    
    lastCountdownNumber = number;
    isShowingCountdown = true;
    
    // カウントダウン表示を更新
    countdownNumber.textContent = number;
    countdownNumber.style.display = 'block';
    countdownText.style.display = 'none';
    countdownDisplay.style.display = 'block';
    
    // Z-indexを確実に最前面に
    countdownDisplay.style.zIndex = '9999';
    
    // アニメーションをリスタート
    countdownNumber.style.animation = 'none';
    setTimeout(() => {
        countdownNumber.style.animation = 'countdown-pulse 1s ease-in-out';
    }, 10);
    
            console.log(`⏰ ${number} seconds remaining! Displaying on screen`);
}

function showTimeUp() {
    const countdownDisplay = document.getElementById('countdown-display');
    const countdownNumber = document.getElementById('countdown-number');
    const countdownText = document.getElementById('countdown-text');
    
    if (!countdownDisplay || !countdownNumber || !countdownText) {
        console.error('Countdown elements not found');
        showFinalResult();
        return;
    }
    
    // TIME UP!表示
    countdownNumber.style.display = 'none';
    countdownText.style.display = 'block';
    countdownDisplay.style.display = 'block';
    countdownDisplay.style.zIndex = '9999';
    
    console.log('⏰ TIME UP! Displaying on screen');
    
    // 1.5秒後にカウントダウンを隠してリザルト表示
    setTimeout(() => {
        countdownDisplay.style.display = 'none';
        showDirectResult();
    }, 1500);
}

function showDirectResult() {
    isGameActive = false;
    isShowingResult = true;
    
    // ゲームBGMを停止
    stopGameBGM();
    
    console.log('🏁 =======================================');
    console.log('🎬 **    GAME OVER!     **');
    console.log('🎭 **  Final Results...  **');
    console.log('🏁 =======================================');
    
    // 直接リザルト画面に移行
    showFinalScore();
}

function showFinalResult() {
    isGameActive = false;
    isShowingResult = true;
    
    console.log('🏁 =======================================');
    console.log('🎬 **    GAME OVER!     **');
    console.log('🎭 **  Final Results...  **');
    console.log('🏁 =======================================');
    
    // ドラマチックな発表演出
    let countdown = 5;
    const resultInterval = setInterval(() => {
        if (countdown > 0) {
            console.log(`🥁 Results in ${countdown}...`);
            
            // レッドカーペットを段階的に光らせる
            if (donutStage) {
                const intensity = (6 - countdown) * 0.2;
                donutStage.material.emissive.setRGB(intensity, 0, 0);
            }
            
            // スポットライト演出
            if (window.holeLight) {
                window.holeLight.intensity = 3 + countdown;
                window.holeLight.color.setHSL(0, 1, 0.5 + countdown * 0.1);
            }
            
            countdown--;
        } else {
            clearInterval(resultInterval);
            showFinalScore();
        }
    }, 1000);
}

function showFinalScore() {
    // プログレス更新と新武器アンロックチェック
    const newlyUnlocked = updateProgressAfterGame(score);
    
    // ランク判定
    let rank = '';
    let rankEmoji = '';
    let message = '';
    
    if (score >= 150) {
        rank = 'LEGEND';
        rankEmoji = '👑';
        message = 'Legendary sniper! Perfect skills!';
    } else if (score >= 120) {
        rank = 'MASTER';
        rankEmoji = '🌟';
        message = 'Master level! Amazing technique!';
    } else if (score >= 90) {
        rank = 'EXPERT';
        rankEmoji = '🏆';
        message = 'Expert! Advanced level skills!';
    } else if (score >= 60) {
        rank = 'ADVANCED';
        rankEmoji = '🥇';
        message = 'Advanced! Excellent performance!';
    } else if (score >= 30) {
        rank = 'INTERMEDIATE';
        rankEmoji = '🥈';
        message = 'Intermediate! Steady improvement!';
    } else if (score >= 10) {
        rank = 'BEGINNER';
        rankEmoji = '🥉';
        message = 'Beginner! Keep practicing!';
    } else if (score >= 0) {
        rank = 'NOVICE';
        rankEmoji = '📘';
        message = 'Novice! Start with the basics!';
    } else {
        rank = 'CURSED';
        rankEmoji = '😈';
        message = 'Cursed soul... possessed by demons!';
    }
    
    // HTMLリザルト画面を表示
    showHTMLResultScreen(score, rank, rankEmoji, message, newlyUnlocked);
    
    // 最終演出
    createGrandFinaleEffect();
}

function showHTMLResultScreen(finalScore, rank, rankEmoji, message, moneyInfo) {
    const resultScreen = document.getElementById('result-screen');
    const resultScore = document.getElementById('result-score');
    const rankEmojiElement = document.getElementById('rank-emoji');
    const rankTextElement = document.getElementById('rank-text');
    const resultMessage = document.getElementById('result-message');
    const replayButton = document.getElementById('replay-button');
    
    // Display score in $ format with commas
    resultScore.textContent = `${getDisplayScore(finalScore)}`;
    rankEmojiElement.textContent = rankEmoji;
    rankTextElement.textContent = rank;
    
    // Check for new high score
    const isNewHighScore = finalScore === highestScore;
    let fullMessage = message;
    
    if (isNewHighScore && finalScore > 0) {
        fullMessage += '\n🎉 NEW HIGH SCORE! 🎉';
    }
    
    // Money earned notification
    if (moneyInfo.earnedMoney > 0) {
        fullMessage += `\n\n💰 MONEY EARNED! 💰\nItems fallen into hole: +$${moneyInfo.earnedMoney.toLocaleString()}`;
        fullMessage += `\nTotal Money: $${moneyInfo.newTotal.toLocaleString()}`;
    }
    
    resultMessage.textContent = fullMessage;
    
    // Add statistics information
    const statsContainer = document.createElement('div');
    statsContainer.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 15px;
        margin: 20px 0;
        text-align: left;
    `;
    
    statsContainer.innerHTML = `
        <h3 style="color: #87CEEB; margin: 0 0 10px 0; text-align: center;">📊 Statistics</h3>
        <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Current Score:</span>
            <span style="color: #FFD700; font-weight: bold;">${getDisplayScore(finalScore)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>High Score:</span>
            <span style="color: #FFD700; font-weight: bold;">${getDisplayScore(highestScore)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Money Earned:</span>
            <span id="animated-money" style="color: #32CD32; font-weight: bold;">+$0</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Total Money:</span>
            <span id="total-money" style="color: #32CD32; font-weight: bold;">$${moneyInfo.previousMoney.toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Games Played:</span>
            <span style="color: #87CEEB; font-weight: bold;">${scoreHistory.length}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 8px 0;">
            <span>Weapons Owned:</span>
            <span style="color: #90EE90; font-weight: bold;">${ownedWeapons.length}/${Object.keys(projectileTypes).length}</span>
        </div>
    `;
    
    // Remove existing stats container if present
    const existingStats = resultScreen.querySelector('.stats-container');
    if (existingStats) {
        existingStats.remove();
    }
    
    statsContainer.className = 'stats-container';
    resultMessage.parentNode.insertBefore(statsContainer, replayButton);
    
    // Animate money earned with reel effect
    if (moneyInfo.earnedMoney > 0) {
        setTimeout(() => {
            animateMoneyReel(moneyInfo.earnedMoney, moneyInfo.previousMoney, moneyInfo.newTotal);
        }, 1000);
    }
    
    // Score color based on performance
    if (finalScore >= 150) {
        resultScore.style.color = '#FFD700'; // Gold
    } else if (finalScore >= 90) {
        resultScore.style.color = '#00FF88'; // Green
    } else if (finalScore >= 30) {
        resultScore.style.color = '#00BFFF'; // Blue
    } else if (finalScore >= 0) {
        resultScore.style.color = '#FFA500'; // Orange
    } else {
        resultScore.style.color = '#FF4444'; // Red
    }
    
    // Special effect for new high score
    if (isNewHighScore && finalScore > 0) {
        resultScore.style.animation = 'glow 2s ease-in-out infinite alternate';
        
        // Add glow effect CSS
        if (!document.getElementById('glow-style')) {
            const glowStyle = document.createElement('style');
            glowStyle.id = 'glow-style';
            glowStyle.textContent = `
                @keyframes glow {
                    from { text-shadow: 0 0 10px #FFD700, 0 0 20px #FFD700, 0 0 30px #FFD700; }
                    to { text-shadow: 0 0 20px #FFD700, 0 0 30px #FFD700, 0 0 40px #FFD700; }
                }
            `;
            document.head.appendChild(glowStyle);
        }
    }
    
    // Show result screen
    resultScreen.style.display = 'block';
    
    // Add replay button event listener
    replayButton.onclick = function() {
        // Reload page
        location.reload();
    };
    
}

function animateMoneyReel(earnedAmount, previousTotal, newTotal) {
    const animatedMoneyElement = document.getElementById('animated-money');
    const totalMoneyElement = document.getElementById('total-money');
    
    if (!animatedMoneyElement || !totalMoneyElement) return;
    
    let currentEarned = 0;
    let currentTotal = gameStartMoney; // ゲーム開始時の金額からスタート
    const duration = 2000; // 2 seconds
    const steps = 60; // 60 frames
    const earnedIncrement = earnedAmount / steps;
    const totalIncrement = (newTotal - gameStartMoney) / steps; // ゲーム開始時から最終金額までの増分
    
    let step = 0;
    
    const reelInterval = setInterval(() => {
        step++;
        currentEarned += earnedIncrement;
        currentTotal += totalIncrement;
        
        // Update displayed values
        animatedMoneyElement.textContent = `+$${Math.floor(currentEarned).toLocaleString()}`;
        totalMoneyElement.textContent = `$${Math.floor(currentTotal).toLocaleString()}`;
        
        // Add reel effect styling
        animatedMoneyElement.style.transform = `scale(${1 + Math.sin(step * 0.3) * 0.1})`;
        animatedMoneyElement.style.color = `hsl(${120 + Math.sin(step * 0.2) * 30}, 100%, ${50 + Math.sin(step * 0.4) * 20}%)`;
        
        // Complete animation
        if (step >= steps) {
            clearInterval(reelInterval);
            animatedMoneyElement.textContent = `+$${earnedAmount.toLocaleString()}`;
            totalMoneyElement.textContent = `$${newTotal.toLocaleString()}`;
            animatedMoneyElement.style.transform = 'scale(1)';
            animatedMoneyElement.style.color = '#32CD32';
            
            // Final flash effect
            animatedMoneyElement.style.boxShadow = '0 0 20px #32CD32';
            setTimeout(() => {
                animatedMoneyElement.style.boxShadow = 'none';
            }, 500);
        }
    }, duration / steps);
}

function createExplosion(position, radius) {
    console.log(`💥 Creating explosion at position (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}) with radius ${radius}`);
    
    // 爆発音を再生
    playBombExplosionSound();
    
    // 爆発エフェクト作成
    createExplosionVisualEffect(position);
    
    // 爆風で周辺のオブジェクトを吹き飛ばす
    rigidBodies.forEach(obj => {
        if (obj.userData.physicsBody && !obj.userData.isBall) {
            const objPos = obj.position;
            const distance = objPos.distanceTo(position);
            
            if (distance <= radius) {
                const direction = new THREE.Vector3().subVectors(objPos, position).normalize();
                const force = (radius - distance) / radius * 50; // 爆風の強さ
                
                // 物理的な力を適用
                const physicsBody = obj.userData.physicsBody;
                physicsBody.setLinearVelocity(new Ammo.btVector3(
                    direction.x * force,
                    Math.abs(direction.y * force) + 10, // 上向きの力を追加
                    direction.z * force
                ));
                
                physicsBody.activate();
                
                // メリーゴーラウンドから解放
                const boxIndex = boxesOnRing.findIndex(boxInfo => boxInfo.mesh === obj);
                if (boxIndex !== -1) {
                    boxesOnRing[boxIndex].isAttachedToRing = false;
                    boxesOnRing[boxIndex].lastHitTime = performance.now();
                }
                
                console.log(`💨 Object affected by explosion at distance ${distance.toFixed(1)}`);
            }
        }
    });
}

function createExplosionVisualEffect(position) {
    // 爆発の光エフェクト
    const explosionLight = new THREE.PointLight(0xFF4444, 20, 15);
    explosionLight.position.copy(position);
    scene.add(explosionLight);
    
    // 光を徐々に減衰させる
    let intensity = 20;
    const lightInterval = setInterval(() => {
        intensity -= 2;
        explosionLight.intensity = Math.max(0, intensity);
        
        if (intensity <= 0) {
            clearInterval(lightInterval);
            scene.remove(explosionLight);
        }
    }, 50);
    
    // 爆発パーティクル
    for (let i = 0; i < 12; i++) {
        setTimeout(() => {
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.3, 8, 8),
                new THREE.MeshBasicMaterial({
                    color: new THREE.Color().setHSL(0.1 + Math.random() * 0.1, 1, 0.5 + Math.random() * 0.3),
                    transparent: true,
                    opacity: 0.8
                })
            );
            
            particle.position.copy(position);
            scene.add(particle);
            
            // ランダムな方向に飛ばす
            const direction = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random(),
                (Math.random() - 0.5) * 2
            ).normalize();
            
            const speed = 5 + Math.random() * 10;
            let life = 1.0;
            
            const animateParticle = () => {
                particle.position.add(direction.clone().multiplyScalar(speed * 0.02));
                particle.position.y += Math.sin(life * Math.PI) * 0.1;
                particle.material.opacity = life;
                particle.scale.multiplyScalar(1.02);
                life -= 0.02;
                
                if (life > 0) {
                    requestAnimationFrame(animateParticle);
                } else {
                    scene.remove(particle);
                }
            };
            animateParticle();
        }, i * 20);
    }
}

function createGrandFinaleEffect() {
    // シンプルなフィナーレ演出
    console.log('🎊 Finale show');
    
    // レッドカーペットの豪華なライトショー
    if (donutStage) {
        let lightShow = 0;
        const lightInterval = setInterval(() => {
            const intensity = Math.sin(lightShow * 0.5) * 0.5 + 0.5;
            donutStage.material.emissive.setRGB(intensity, intensity * 0.2, 0);
            lightShow++;
            if (lightShow >= 20) {
                clearInterval(lightInterval);
                donutStage.material.emissive.setHex(0x330000);
            }
        }, 150);
    }
}



function resetGame() {
    // ゲーム状態をリセット
    score = 0;
    isGameActive = false;
    isShowingResult = false;
    isShowingCountdown = false;
    lastCountdownNumber = -1;
    lastResultTime = 0;
    gameStartTime = null;
    selectedProjectileType = null; // 武器選択をリセット
    
    // カウントダウン表示を隠す
    const countdownDisplay = document.getElementById('countdown-display');
    if (countdownDisplay) {
        countdownDisplay.style.display = 'none';
    }
    
    // 既存のオブジェクトをクリア
    boxesOnRing.length = 0;
    
    // 物理世界から全てのリジッドボディを削除
    for (let i = rigidBodies.length - 1; i >= 0; i--) {
        const obj = rigidBodies[i];
        scene.remove(obj);
        if (obj.userData.physicsBody) {
            physicsWorld.removeRigidBody(obj.userData.physicsBody);
            Ammo.destroy(obj.userData.physicsBody);
        }
    }
    rigidBodies.length = 0;
    
    // 新しいオブジェクトを生成
    createBoxesOnDonut();
    
    // ライト効果をリセット
    if (window.holeLight) {
        window.holeLight.intensity = 2;
        window.holeLight.color.setHex(0xFF69B4);
    }
    
    if (donutStage) {
        donutStage.material.emissive.setHex(0x330000);
    }
    
    console.log('🔄 Game reset complete!');
}

// 祝福エフェクトは削除



function getDisplayScore(rawScore) {
    const money = rawScore * 1000;
    return `$${money.toLocaleString()}`;
}

function updateUI() {
    const counterElement = document.getElementById('counter');
    if (counterElement && !isShowingResult) {
        if (isGameActive && gameStartTime) {
            // スコアは表示しない
            const currentTime = performance.now();
            const elapsedTime = (currentTime - gameStartTime) / 1000;
            const remainingTime = Math.max(0, gameTime - elapsedTime);
            counterElement.textContent = `Time remaining: ${Math.ceil(remainingTime)}s`;
        } else {
            // Only show score at game end (on result screen)
            counterElement.textContent = '';
        }
    } else if (counterElement && isShowingResult) {
        counterElement.textContent = `🎬 Final results being announced... 🎭`;
    }
    // スロット関連のUIを隠す
    const slotStatusElement = document.getElementById('slot-status');
    if (slotStatusElement) {
        slotStatusElement.style.display = 'none';
    }
}

function loadSelectedProjectile(position, velocity, config) {
    // 発射音を再生
    playProjectileSound(selectedProjectileType);
    
    gltfLoader.load(
        config.model,
        function(gltf) {
            console.log(`${config.name} projectile loaded successfully`);
            
            const model = gltf.scene.clone();
            
            // モデルのスケールを調整
            model.scale.set(config.scale, config.scale, config.scale);
            
            // モデルの位置を設定
            model.position.copy(position);
            
            // シャドウを有効にする
            model.traverse(function(child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            // 物理ボディを作成（球形で近似して軽量化）
            const radius = 0.4;
            const shape = new Ammo.btSphereShape(radius);
            shape.setMargin(margin);
            
            // 物理ボディを追加
            const quat = new THREE.Quaternion();
            const body = createRigidBodyForModel(model, shape, config.mass, position, quat);
            body.setFriction(0.5);
            
            // 速度を設定
            body.setLinearVelocity(new Ammo.btVector3(velocity.x, velocity.y, velocity.z));
            
            // 発射体として設定
            model.userData.isBall = true;
            model.userData.projectileType = selectedProjectileType;
            model.userData.creationTime = performance.now();
            
            // 爆弾の場合は爆発タイマーを設定
            if (selectedProjectileType === 'bomb') {
                model.userData.isExplosive = true;
                model.userData.explosionTime = performance.now() + config.explosionDelay;
                model.userData.explosionRadius = config.explosionRadius;
                console.log('💣 Bomb armed! Will explode in 2 seconds...');
            }
            
            console.log(`${config.name} projectile added to scene with physics`);
        },
        function(progress) {
            console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
        },
        function(error) {
            console.error(`Error loading ${config.model}:`, error);
            console.log('Creating fallback sphere instead');
            
                         // フォールバック：モデルが読み込めない場合は球を作成
            const ballRadius = 0.4;
            const fallbackColor = selectedProjectileType === 'bomb' ? 0xFF4444 : 
                                 selectedProjectileType === 'cocktail' ? 0xFF69B4 : 0x8B4513;
            const fallbackMaterial = new THREE.MeshPhongMaterial({ color: fallbackColor });
            const ball = new THREE.Mesh(new THREE.SphereGeometry(ballRadius, 18, 16), fallbackMaterial);
            ball.castShadow = true;
            ball.receiveShadow = true;
            const ballShape = new Ammo.btSphereShape(ballRadius);
            ballShape.setMargin(margin);
            const fallbackQuat = new THREE.Quaternion(0, 0, 0, 1);
            const ballBody = createRigidBody(ball, ballShape, config.mass, position, fallbackQuat);
            ballBody.setFriction(0.5);
            ballBody.setLinearVelocity(new Ammo.btVector3(velocity.x, velocity.y, velocity.z));
            
            ball.userData.isBall = true;
            ball.userData.projectileType = selectedProjectileType;
            ball.userData.creationTime = performance.now();
            
            // 爆弾の場合は爆発タイマーを設定
            if (selectedProjectileType === 'bomb') {
                ball.userData.isExplosive = true;
                ball.userData.explosionTime = performance.now() + config.explosionDelay;
                ball.userData.explosionRadius = config.explosionRadius;
                console.log('💣 Fallback bomb armed! Will explode in 2 seconds...');
            }
        }
    );
}

function loadFighterModel(position, mass = 1) {
    // 3Dモデル読み込み開始を通知
    if (isLoadingModels) onModelLoadStart();
    
    gltfLoader.load(
        'Fighter2.glb',
        function(gltf) {
            console.log('Fighter2.glb loaded successfully');
            
            const model = gltf.scene;
            
            // モデルのスケールを調整
            model.scale.set(0.5, 0.5, 0.5);
            
            // モデルの位置を設定
            model.position.copy(position);
            
            // シャドウを有効にする
            model.traverse(function(child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            // バウンディングボックスを計算
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            
            // 物理ボディを作成（ボックス形状で近似）
            const shape = new Ammo.btBoxShape(new Ammo.btVector3(
                size.x * 0.25, // スケールを考慮
                size.y * 0.25,
                size.z * 0.25
            ));
            shape.setMargin(margin);
            
            // 物理ボディを追加
            const quat = new THREE.Quaternion();
            createRigidBodyForModel(model, shape, mass, position, quat);
            
            console.log('Fighter model added to scene with physics'); if (isLoadingModels) onModelLoadComplete();
        },
        function(progress) {
            console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
        },
        function(error) {
            console.error('Error loading Fighter2.glb:', error);
            console.log('Creating fallback cube instead'); if (isLoadingModels) onModelLoadComplete();
            
            // フォールバック：モデルが読み込めない場合はカラフルなキューブを作成
            const fallbackMaterial = new THREE.MeshPhongMaterial({ color: 0xFF69B4 });
            const fallbackCube = createParalellepiped(1, 1, 1, mass, position, new THREE.Quaternion(), fallbackMaterial);
            fallbackCube.castShadow = true;
            fallbackCube.receiveShadow = true;
        }
    );
}

function createRigidBodyForModel(threeObject, physicsShape, mass, pos, quat) {
    threeObject.position.copy(pos);
    threeObject.quaternion.copy(quat);

    const transform = new Ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
    transform.setRotation(new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w));
    const motionState = new Ammo.btDefaultMotionState(transform);

    const localInertia = new Ammo.btVector3(0, 0, 0);
    physicsShape.calculateLocalInertia(mass, localInertia);

    const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, physicsShape, localInertia);
    const body = new Ammo.btRigidBody(rbInfo);

    threeObject.userData.physicsBody = body;

    scene.add(threeObject);

    if (mass > 0) {
        rigidBodies.push(threeObject);
        body.setActivationState(4);
    }

    physicsWorld.addRigidBody(body);

    return body;
}

function loadTargetModel(modelType, position, initialAngle, radius, height, mass = 1, points = 1) {
    // モデルタイプからファイルパスを決定
    const modelPaths = {
        'halloween1': 'target/_halloween_A_sophis_1022135708_refine.glb',
        'halloween2': 'target/_halloween_The_obje_1022134056_refine.glb',
        'car': 'target/car.glb',
        'car2': 'target/car2.glb',
        'devil': 'target/devil.glb',
        'fighter': 'target/Fighter2.glb',
        'king': 'target/king.glb'
    };
    
    const modelPath = modelPaths[modelType];
    if (!modelPath) {
        console.error(`未知のモデルタイプ: ${modelType}`);
        return;
    }
    
    // ポイント別の色設定（視覚的フィードバック）
    let logColor = '🎯';
    if (points >= 25) logColor = '👑'; // 王様、馬
    else if (points >= 15) logColor = '🏆'; // ハロウィン、ファイター
    else if (points >= 10) logColor = '🚗'; // 車
    else if (points < 0) logColor = '😈'; // 悪魔
    else logColor = '😴'; // スリープ
    
    // 3Dモデル読み込み開始を通知
    if (isLoadingModels) onModelLoadStart();
    
    gltfLoader.load(
        modelPath,
        function(gltf) {
            console.log(`${logColor} ${modelType}モデル読み込み成功！ポイント: ${points}`);
            
            const model = gltf.scene.clone();
            
            // モデルサイズをタイプ別に調整（全体的に大きく）
            let scale = 0.6;
            if (modelType === 'devil' || modelType === 'king') scale = 0.5; // 大きいモデル
            else if (modelType === 'car' || modelType === 'car2') scale = 0.55;
            
            model.scale.set(scale, scale, scale);
            model.position.copy(position);
            
            // シャドウを有効にする
            model.traverse(function(child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            // ポイントとタイプ情報を設定
            model.userData.points = points;
            model.userData.objectType = modelType;
            
            // バウンディングボックスを計算
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            
            // 物理ボディを作成（ボックス形状で近似）
            const shape = new Ammo.btBoxShape(new Ammo.btVector3(
                Math.max(size.x * 0.4, 0.3), // 最小サイズを保証
                Math.max(size.y * 0.4, 0.3),
                Math.max(size.z * 0.4, 0.3)
            ));
            shape.setMargin(margin);
            
            // 物理ボディを追加
            const quat = new THREE.Quaternion();
            const body = createRigidBodyForModel(model, shape, mass, position, quat);
            
            // メリーゴーラウンド用にモデルの初期位置を記録
            boxesOnRing.push({
                mesh: model,
                body: body,
                initialAngle: initialAngle,
                radius: radius,
                height: height,
                isAttachedToRing: true,
                lastHitTime: 0
            });
            
            console.log(`${logColor} ${modelType}をメリーゴーラウンドに配置完了`);
            
            // 3Dモデル読み込み完了を通知
            if (isLoadingModels) onModelLoadComplete();
        },
        function(progress) {
            // プログレス表示は簡略化
        },
        function(error) {
            console.error(`${modelType}のロードに失敗:`, error);
            
            // フォールバック：カラフルなキューブを作成
            const fallbackColors = {
                'devil': 0x8B0000,     // 暗赤
                'king': 0xFFD700,      // ゴールド
                'car': 0x4169E1,       // ロイヤルブルー
                'car2': 0xFF6347,      // トマト色
                'fighter': 0x32CD32,   // ライムグリーン
                'halloween1': 0xFF4500, // オレンジレッド
                'halloween2': 0x9400D3  // バイオレット
            };
            
            const fallbackMaterial = new THREE.MeshPhongMaterial({ 
                color: fallbackColors[modelType] || 0xFF69B4 
            });
            const fallbackCube = createParalellepiped(0.7, 0.7, 0.7, mass, position, new THREE.Quaternion(), fallbackMaterial);
            fallbackCube.castShadow = true;
            fallbackCube.receiveShadow = true;
            fallbackCube.userData.points = points;
            fallbackCube.userData.objectType = modelType;
            
            boxesOnRing.push({
                mesh: fallbackCube,
                body: fallbackCube.userData.physicsBody,
                initialAngle: initialAngle,
                radius: radius,
                height: height,
                isAttachedToRing: true,
                lastHitTime: 0
            });
            
            console.log(`${logColor} ${modelType}の代替キューブを配置`);
            
            // 3Dモデル読み込み完了を通知（エラーの場合でも）
            if (isLoadingModels) onModelLoadComplete();
        }
    );
}

function loadHalloweenModel1(position, initialAngle, radius, height, mass = 1) { if (isLoadingModels) onModelLoadStart();
    gltfLoader.load(
        '_halloween_A_sophis_1022135708_refine.glb',
        function(gltf) {
            console.log('🎃✨ Rare Halloween Model 1 appeared! (5x weight)');
            
            const model = gltf.scene.clone();
            
            // モデルのスケールを調整
            model.scale.set(0.5, 0.5, 0.5);
            
            // モデルの位置を設定
            model.position.copy(position);
            
            // シャドウを有効にする
            model.traverse(function(child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            // バウンディングボックスを計算
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            
            // 物理ボディを作成（ボックス形状で近似）
            const shape = new Ammo.btBoxShape(new Ammo.btVector3(
                Math.max(size.x * 0.25, 0.3), // 最小サイズを保証
                Math.max(size.y * 0.25, 0.3),
                Math.max(size.z * 0.25, 0.3)
            ));
            shape.setMargin(margin);
            
            // 物理ボディを追加
            const quat = new THREE.Quaternion();
            const body = createRigidBodyForModel(model, shape, mass, position, quat);
            
            // メリーゴーラウンド用にモデルの初期位置を記録
            boxesOnRing.push({
                mesh: model,
                body: body,
                initialAngle: initialAngle,
                radius: radius,
                height: height,
                isAttachedToRing: true,
                lastHitTime: 0
            });
            
            console.log('🎃 レアアイテムをメリーゴーラウンドに配置！'); if (isLoadingModels) onModelLoadComplete();
        },
        function(progress) {
            console.log('ハロウィンモデル1ロード進行:', (progress.loaded / progress.total * 100) + '%');
        },
        function(error) {
            console.error('ハロウィンモデル1のロードに失敗:', error);
            
            // フォールバック：モデルが読み込めない場合はレアなオレンジ色のキューブを作成
            console.log('🎃⚠️ レアモデルの代わりに重いオレンジキューブを配置'); if (isLoadingModels) onModelLoadComplete();
            const fallbackMaterial = new THREE.MeshPhongMaterial({ color: 0xFF6600 });
            const fallbackCube = createParalellepiped(0.7, 0.7, 0.7, mass, position, new THREE.Quaternion(), fallbackMaterial);
            fallbackCube.castShadow = true;
            fallbackCube.receiveShadow = true;
            
            boxesOnRing.push({
                mesh: fallbackCube,
                body: fallbackCube.userData.physicsBody,
                initialAngle: initialAngle,
                radius: radius,
                height: height,
                isAttachedToRing: true,
                lastHitTime: 0
            });
        }
    );
}

function loadHalloweenModel2(position, initialAngle, radius, height, mass = 1) { if (isLoadingModels) onModelLoadStart();
    gltfLoader.load(
        '_halloween_The_obje_1022134056_refine.glb',
        function(gltf) {
            console.log('🎃✨ Rare Halloween Model 2 appeared! (5x weight)');
            
            const model = gltf.scene.clone();
            
            // モデルのスケールを調整
            model.scale.set(0.5, 0.5, 0.5);
            
            // モデルの位置を設定
            model.position.copy(position);
            
            // シャドウを有効にする
            model.traverse(function(child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            // バウンディングボックスを計算
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            
            // 物理ボディを作成（ボックス形状で近似）
            const shape = new Ammo.btBoxShape(new Ammo.btVector3(
                Math.max(size.x * 0.25, 0.3), // 最小サイズを保証
                Math.max(size.y * 0.25, 0.3),
                Math.max(size.z * 0.25, 0.3)
            ));
            shape.setMargin(margin);
            
            // 物理ボディを追加
            const quat = new THREE.Quaternion();
            const body = createRigidBodyForModel(model, shape, mass, position, quat);
            
            // メリーゴーラウンド用にモデルの初期位置を記録
            boxesOnRing.push({
                mesh: model,
                body: body,
                initialAngle: initialAngle,
                radius: radius,
                height: height,
                isAttachedToRing: true,
                lastHitTime: 0
            });
            
            console.log('🎃 レアアイテムをメリーゴーラウンドに配置！'); if (isLoadingModels) onModelLoadComplete();
        },
        function(progress) {
            console.log('ハロウィンモデル2ロード進行:', (progress.loaded / progress.total * 100) + '%');
        },
        function(error) {
            console.error('ハロウィンモデル2のロードに失敗:', error);
            
            // フォールバック：モデルが読み込めない場合はレアな紫色のキューブを作成
            console.log('🎃⚠️ レアモデルの代わりに重い紫キューブを配置'); if (isLoadingModels) onModelLoadComplete();
            const fallbackMaterial = new THREE.MeshPhongMaterial({ color: 0x6600FF });
            const fallbackCube = createParalellepiped(0.7, 0.7, 0.7, mass, position, new THREE.Quaternion(), fallbackMaterial);
            fallbackCube.castShadow = true;
            fallbackCube.receiveShadow = true;
            
            boxesOnRing.push({
                mesh: fallbackCube,
                body: fallbackCube.userData.physicsBody,
                initialAngle: initialAngle,
                radius: radius,
                height: height,
                isAttachedToRing: true,
                lastHitTime: 0
            });
        }
    );
}

// ユーザー操作リスナーの設定
function setupUserInteractionListeners() {
    const interactionEvents = ['click', 'touchstart', 'keydown', 'mousedown'];
    
    function handleFirstInteraction() {
        if (!userHasInteracted) {
            userHasInteracted = true;
            console.log('👆 User interaction detected, enabling audio...');
            
            // BGM再生を試行
            if (audioPreloaded && selectionBGM) {
                setTimeout(() => {
                    playBGMInstantly();
                }, 50);
            }
            
            // リスナーを削除（一度だけ実行）
            interactionEvents.forEach(event => {
                document.removeEventListener(event, handleFirstInteraction, true);
            });
        }
    }
    
    // 全ての操作イベントにリスナーを追加
    interactionEvents.forEach(event => {
        document.addEventListener(event, handleFirstInteraction, true);
    });
}

function playStartSound() {
    if (startSound && isSoundEnabled && userHasInteracted) {
        startSound.currentTime = 0;
        startSound.play().catch(error => {
            console.warn('🔇 Start sound failed to play:', error);
        });
    }
}

function playSelectSound() {
    if (selectSound && isSoundEnabled && userHasInteracted) {
        selectSound.currentTime = 0;
        selectSound.play().catch(error => {
            console.warn('🔇 Select sound failed to play:', error);
        });
    }
}

function playProjectileSound(projectileType) {
    if (!isSoundEnabled || !userHasInteracted) return;
    
    let sound = null;
    switch (projectileType) {
        case 'beer':
            sound = beerSound;
            break;
        case 'cocktail':
            sound = cocktailSound;
            break;
        case 'bomb':
            sound = beerSound; // 爆弾発射時はビール音
            break;
        default:
            return;
    }
    
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(error => {
            console.warn(`🔇 ${projectileType} sound failed to play:`, error);
        });
    }
}

function playBombExplosionSound() {
    if (bombSound && isSoundEnabled && userHasInteracted) {
        bombSound.currentTime = 0;
        bombSound.play().catch(error => {
            console.warn('🔇 Bomb explosion sound failed to play:', error);
        });
    }
}

function startGameBGM() {
    // メニューBGMを停止
    if (selectionBGM && !selectionBGM.paused) {
        selectionBGM.pause();
        selectionBGM.currentTime = 0;
    }
    
    // ゲームBGMを開始
    if (gameBGM && isSoundEnabled && userHasInteracted) {
        gameBGM.currentTime = 0;
        gameBGM.play().then(() => {
            console.log('🎮 Game BGM started!');
        }).catch(error => {
            console.warn('🔇 Game BGM failed to play:', error);
        });
    }
}

function stopGameBGM() {
    if (gameBGM && !gameBGM.paused) {
        gameBGM.pause();
        gameBGM.currentTime = 0;
        console.log('🔇 Game BGM stopped');
    }
}

function playGetSound() {
    if (getSound && isSoundEnabled && userHasInteracted) {
        getSound.currentTime = 0;
        getSound.play().catch(error => {
            console.warn('🔇 Get sound failed to play:', error);
        });
    }
}

function playHitSound() {
    if (hitSound && isSoundEnabled && userHasInteracted) {
        hitSound.currentTime = 0;
        hitSound.play().catch(error => {
            console.warn('🔇 Hit sound failed to play:', error);
        });
    }
}

function playBadSound() {
    if (badSound && isSoundEnabled && userHasInteracted) {
        badSound.currentTime = 0;
        badSound.play().catch(error => {
            console.warn('🔇 Bad sound failed to play:', error);
        });
    } else if (!userHasInteracted) {
        console.log('🔇 Bad sound requires user interaction first');
    }
}

function showHelpModal() {
    console.log('❓ Opening help modal');
    
    // Remove any existing modal first
    const existingModal = document.getElementById('help-modal-bg');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }
    
    // Create modal background
    const modalBg = document.createElement('div');
    modalBg.id = 'help-modal-bg';
    modalBg.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 50000;
        animation: fadeIn 0.3s ease;
    `;
    
    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: linear-gradient(145deg, #2c3e50, #34495e);
        border-radius: 20px;
        padding: 30px;
        max-width: 700px;
        width: 90%;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        border: 2px solid #3498DB;
        color: white;
        text-align: center;
        animation: slideIn 0.3s ease;
        position: relative;
        z-index: 50001;
    `;
    
    // Create help HTML content
    let helpHTML = `
        <h2 style="color: #3498DB; margin-bottom: 20px; font-size: 28px;">
            ❓ Game Tutorial & Rules ❓
        </h2>
        
        <div style="text-align: left; line-height: 1.6;">
            
            <div style="background: rgba(52, 152, 219, 0.1); padding: 20px; border-radius: 15px; margin-bottom: 20px;">
                <h3 style="color: #3498DB; margin-bottom: 15px;">🎯 Game Objective</h3>
                <p style="margin: 10px 0;">
                    Shoot objects into the rotating donut stage's <strong>central hole</strong> to earn as many points as possible within <strong>15 seconds</strong>!
                </p>
            </div>
            
            <div style="background: rgba(46, 204, 113, 0.1); padding: 20px; border-radius: 15px; margin-bottom: 20px;">
                <h3 style="color: #2ECC71; margin-bottom: 15px;">🎮 How to Play</h3>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li><strong>Mouse Click</strong>: Shoot weapons</li>
                    <li><strong>Camera Control</strong>: Drag with the mouse to change view</li>
                    <li><strong>Zoom</strong>: Use the mouse wheel to zoom in and out</li>
                </ul>
            </div>
            
            <div style="background: rgba(241, 196, 15, 0.1); padding: 20px; border-radius: 15px; margin-bottom: 20px;">
                <h3 style="color: #F1C40F; margin-bottom: 15px;">💰 Point & Reward System</h3>
                <div style="margin: 10px 0;">
                    <div style="margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 5px;">
                        📦 <strong>BOX</strong>: 1 point ($1,000)
                    </div>
                    <div style="margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 5px;">
                        🚗 <strong>Car</strong>: 10 points ($10,000)
                    </div>
                    <div style="margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 5px;">
                        🎃 <strong>Halloween</strong>: 15 points ($15,000)
                    </div>
                    <div style="margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 5px;">
                        🥊 <strong>Fighter</strong>: 20 points ($20,000)
                    </div>
                    <div style="margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 5px;">
                        👑 <strong>King</strong>: 30 points ($30,000)
                    </div>
                    <div style="margin: 8px 0; padding: 8px; background: rgba(231, 76, 60, 0.2); border-radius: 5px; border: 1px solid #e74c3c;">
                        😈 <strong>Devil</strong>: -50 points (-$50,000) ⚠️Danger⚠️
                    </div>
                </div>
            </div>
            
            <div style="background: rgba(155, 89, 182, 0.1); padding: 20px; border-radius: 15px; margin-bottom: 20px;">
                <h3 style="color: #9B59B6; margin-bottom: 15px;">🔫 Weapon System</h3>
                <p style="margin: 10px 0; color: #BDC3C7; font-size: 14px;">
                    Weapons can be purchased at "Bar Merry-Round".
                </p>
                <div style="margin: 10px 0;">
                    <div style="margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 5px;">
                        🍺 <strong>Beer Bottle</strong>: Free | Speed 14 | Mass 3 | Cooldown 0.5 seconds
                    </div>
                    <div style="margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 5px;">
                        🍸 <strong>Cocktail Glass</strong>: $150,000 | Speed 18 | Mass 2 | Cooldown 0.25 seconds
                    </div>
                    <div style="margin: 8px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 5px;">
                        💣 <strong>Party Bomb</strong>: $500,000 | Speed 12 | Mass 4 | Explodes after 2 seconds
                    </div>
                </div>
            </div>
            
            <div style="background: rgba(231, 76, 60, 0.1); padding: 20px; border-radius: 15px; margin-bottom: 20px;">
                <h3 style="color: #E74C3C; margin-bottom: 15px;">⚠️ Important Points</h3>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li><strong>Weight System</strong>: Objects with higher points are heavier and harder to drop</li>
                    <li><strong>Devil's Trap</strong>: Light and easy to move, but -50 points for a big deduction</li>
                    <li><strong>Merry-Go-Round</strong>: The stage rotates, so adjust your aim accordingly</li>
                    <li><strong>Auto-removal</strong>: Weapons fired will automatically disappear after 3 seconds (excluding bombs)</li>
                </ul>
            </div>
            
            <div style="background: rgba(52, 73, 94, 0.3); padding: 20px; border-radius: 15px; margin-bottom: 20px;">
                <h3 style="color: #34495E; margin-bottom: 15px;">🏆 Strategies</h3>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Start with lighter objects (BOX) to build up funds</li>
                    <li>Shoot consecutively with cocktails to hit medium points</li>
                    <li>Use bombs to blow away heavier objects with wind</li>
                    <li>Avoid the devil at all costs!</li>
                </ul>
            </div>
            
        </div>
        
        <button id="close-help" style="
            background: linear-gradient(45deg, #3498DB, #2980B9);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            margin-top: 20px;
            transition: all 0.3s ease;
        ">Understood! Start the game</button>
        
        <div style="
            margin-top: 15px;
            padding: 8px;
            text-align: center;
            font-size: 11px;
            color: #BDC3C7;
            border-top: 1px solid rgba(255,255,255,0.1);
        ">
            Created by <strong>R creative Lab</strong><br>
            <a href="https://R-TARO.com" target="_blank" style="color: #87CEEB; text-decoration: none;">R-TARO.com</a>
        </div>
    `;
    
    modal.innerHTML = helpHTML;
    modalBg.appendChild(modal);
    
    // Add CSS animations
    const style = document.createElement('style');
    style.id = 'help-modal-style';
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideIn {
            from { transform: translateY(-50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        #close-help:hover {
            transform: scale(1.05);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
        }
    `;
    document.head.appendChild(style);
    
    // Add close functionality
    const closeButton = modal.querySelector('#close-help');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            console.log('❓ Closing help modal');
            if (document.body.contains(modalBg)) {
                document.body.removeChild(modalBg);
            }
            const styleElement = document.getElementById('help-modal-style');
            if (styleElement && document.head.contains(styleElement)) {
                document.head.removeChild(styleElement);
            }
        });
    }
    
    // Close on background click
    modalBg.addEventListener('click', (e) => {
        if (e.target === modalBg) {
            console.log('❓ Closing help modal (background click)');
            if (document.body.contains(modalBg)) {
                document.body.removeChild(modalBg);
            }
            const styleElement = document.getElementById('help-modal-style');
            if (styleElement && document.head.contains(styleElement)) {
                document.head.removeChild(styleElement);
            }
        }
    });
    
    document.body.appendChild(modalBg);
    console.log('❓ Help modal added to DOM');
}

function waitForModelsToLoad() {
    if (!isLoadingModels) {
        // モデル読み込みが開始されていない場合は即座に完了
        finishLoading();
        return;
    }
    
    const checkInterval = setInterval(() => {
        if (totalModelsToLoad > 0 && modelsLoaded >= totalModelsToLoad) {
            clearInterval(checkInterval);
            finishLoading();
        } else {
            // プログレスを更新
            const modelProgress = totalModelsToLoad > 0 ? (modelsLoaded / totalModelsToLoad) * 30 : 0;
            const finalProgress = 70 + modelProgress; // 70% + 30% for models
            updateLoadingProgress(Math.min(finalProgress, 99));
            updateLoadingText(`Loading 3D models... (${modelsLoaded}/${totalModelsToLoad})`);
        }
    }, 100);
    
    // タイムアウト機能（最大15秒）
    setTimeout(() => {
        clearInterval(checkInterval);
        console.warn('⚠️ Model loading timeout, starting game anyway');
        finishLoading();
    }, 15000);
}

function finishLoading() { if (isLoadingFinished) { console.log("⚠️ Loading already finished, skipping duplicate call"); return; } isLoadingFinished = true; console.log("🎮 Starting game loading finish sequence");
    updateLoadingText('Game ready!');
    updateLoadingProgress(100);
    
    setTimeout(() => {
        hideLoadingScreen();
        startGame();
    }, 1000);
}

function onModelLoadStart() {
    totalModelsToLoad++;
    console.log(`📦 Model loading started. Total to load: ${totalModelsToLoad}`);
}

function onModelLoadComplete() {
    modelsLoaded++;
    console.log(`✅ Model loaded. Progress: ${modelsLoaded}/${totalModelsToLoad}`);
}

