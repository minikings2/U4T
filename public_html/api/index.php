<?php
declare(strict_types=1);
define('APP_SECURE_INIT', true);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

$configFile = dirname(__DIR__, 2) . '/config.local.php';
if (!is_file($configFile)) { http_response_code(500); echo json_encode(['success'=>false,'error'=>'Ошибка конфигурации сервера']); exit; }
$config = require $configFile;
$runtimeDir = rtrim((string)$config['app']['runtime_dir'], '/\\');
foreach (['/logs','/sessions'] as $sub) if (!is_dir($runtimeDir.$sub)) @mkdir($runtimeDir.$sub,0750,true);
ini_set('session.save_path',$runtimeDir.'/sessions');
ini_set('session.use_strict_mode','1');
ini_set('session.cookie_httponly','1');
ini_set('session.cookie_samesite','Lax');
ini_set('session.cookie_path','/');
if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ini_set('session.cookie_secure','1');
session_start();


function gigachatVerifySsl(array $gc): bool { return !empty($gc['verify_ssl']); }
function gigachatToken(array $cfg, string $runtimeDir): string {
    $gc=$cfg['gigachat']??[]; $key=trim((string)($gc['authorization_key']??''));
    if($key==='') throw new RuntimeException('GigaChat не настроен на сервере.');
    $scope=(string)($gc['scope']??'GIGACHAT_API_PERS');
    // Кэш токена на диске: у каждого запроса свой процесс, в сессии токен переиспользовался бы только внутри одного пользователя.
    $cacheFile=$runtimeDir.'/gigachat_token.json';
    $fp=substr(hash('sha256',$key.'|'.$scope),0,16);
    if(is_file($cacheFile)){
        $c=json_decode((string)@file_get_contents($cacheFile),true);
        if(is_array($c)&&($c['fp']??'')===$fp&&(int)($c['expires']??0)>time()+60&&!empty($c['token'])) return (string)$c['token'];
    }
    $verify=gigachatVerifySsl($gc);
    $ch=curl_init('https://ngw.devices.sberbank.ru:9443/api/v2/oauth');
    $headerList=['Content-Type: application/x-www-form-urlencoded','Accept: application/json','RqUID: '.uuid(),'Authorization: Basic '.$key];
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>$headerList,CURLOPT_POSTFIELDS=>http_build_query(['scope'=>$scope]),CURLOPT_TIMEOUT=>20,CURLOPT_SSL_VERIFYPEER=>$verify,CURLOPT_SSL_VERIFYHOST=>$verify?2:0]);
    $raw=curl_exec($ch);$err=curl_error($ch);$code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
    if($raw===false||$code<200||$code>=300){logPrivate('GIGACHAT TOKEN HTTP '.$code.' '.$err.' '.substr((string)$raw,0,500),$runtimeDir);throw new RuntimeException('Не удалось авторизоваться в GigaChat.');}
    $d=json_decode((string)$raw,true);$token=(string)($d['access_token']??'');if($token==='')throw new RuntimeException('GigaChat не вернул токен доступа.');
    // Сбер отдаёт expires_at в миллисекундах — переводим в секунды, иначе токен считается вечным и ловит 401 после реального протухания.
    $expMs=(int)($d['expires_at']??0);$expires=$expMs>1000000000000?intdiv($expMs,1000):time()+1500;
    @file_put_contents($cacheFile,json_encode(['fp'=>$fp,'token'=>$token,'expires'=>$expires]),LOCK_EX);
    return $token;
}
function gigachatComplete(array $cfg,string $runtimeDir,array $messages): string {
    $token=gigachatToken($cfg,$runtimeDir);$gc=$cfg['gigachat']??[];
    $payload=['model'=>(string)($gc['model']??'GigaChat'),'messages'=>$messages,'stream'=>false];
    $base=rtrim((string)($gc['base_url']??'https://gigachat.devices.sberbank.ru/api/v1'),'/');$verify=gigachatVerifySsl($gc);
    $ch=curl_init($base.'/chat/completions');curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','Accept: application/json','Authorization: Bearer '.$token],CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),CURLOPT_TIMEOUT=>45,CURLOPT_SSL_VERIFYPEER=>$verify,CURLOPT_SSL_VERIFYHOST=>$verify?2:0]);
    $raw=curl_exec($ch);$err=curl_error($ch);$code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
    if($raw===false||$code<200||$code>=300){if($code===401){@unlink($runtimeDir.'/gigachat_token.json');}logPrivate('GIGACHAT CHAT HTTP '.$code.' '.$err.' '.substr((string)$raw,0,700),$runtimeDir);throw new RuntimeException('GigaChat временно недоступен. Попробуйте ещё раз.');}
    $d=json_decode((string)$raw,true);$text=$d['choices'][0]['message']['content']??'';if(is_array($text))$text=json_encode($text,JSON_UNESCAPED_UNICODE);$text=trim((string)$text);if($text==='')throw new RuntimeException('GigaChat не вернул ответ.');return $text;
}
function extractJsonObject(string $text): array {
    $text=trim($text);if(str_starts_with($text,'```'))$text=preg_replace('/^```(?:json)?\s*|\s*```$/i','',$text);
    $d=json_decode($text,true);if(is_array($d))return $d;
    if(preg_match('/\{.*\}/s',$text,$m)){ $d=json_decode($m[0],true); if(is_array($d))return $d; }
    return [];
}

function out(array $data, int $code=200): never { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); exit; }
function logPrivate(string $m,string $dir): void { @file_put_contents($dir.'/logs/app.log','['.date('Y-m-d H:i:s').'] '.$m."\n",FILE_APPEND|LOCK_EX); }
function csrf(): string { if (empty($_SESSION['csrf_token'])) $_SESSION['csrf_token']=bin2hex(random_bytes(32)); return (string)$_SESSION['csrf_token']; }
function input(): array { $raw=file_get_contents('php://input'); $v=json_decode($raw ?: '{}',true); return is_array($v)?$v:[]; }
function uuid(): string { return sprintf('%s-%s-%s-%s-%s',bin2hex(random_bytes(4)),bin2hex(random_bytes(2)),bin2hex(random_bytes(2)),bin2hex(random_bytes(2)),bin2hex(random_bytes(6))); }
function tableExists(PDO $pdo, string $table): bool { try { $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?"); $st->execute([$table]); return (bool)$st->fetchColumn(); } catch(Throwable $e){ return false; } }
function columnExists(PDO $pdo,string $table,string $column): bool { try { $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?");$st->execute([$table,$column]);return (bool)$st->fetchColumn(); }catch(Throwable $e){return false;} }
function ensureChatSchema(PDO $pdo,string $runtimeDir): void {
    if(!tableExists($pdo,'chat_messages')) return;
    try {
        if(!columnExists($pdo,'chat_messages','recipient_id')) $pdo->exec('ALTER TABLE `chat_messages` ADD COLUMN `recipient_id` BIGINT UNSIGNED NULL AFTER `sender_id`');
        if(!columnExists($pdo,'chat_messages','read_at')) $pdo->exec('ALTER TABLE `chat_messages` ADD COLUMN `read_at` DATETIME NULL AFTER `updated_at`');
        $st=$pdo->query("SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='chat_messages' AND index_name='idx_recipient'");
        if(!(int)$st->fetchColumn()) $pdo->exec('ALTER TABLE `chat_messages` ADD INDEX `idx_recipient` (`recipient_id`)');
    } catch(Throwable $e) { logPrivate('CHAT SCHEMA: '.$e->getMessage(), $runtimeDir); }
}

function publicUser(array $u): array {
    return [
        'id'=>(int)$u['id'],'username'=>(string)$u['username'],'role'=>(string)$u['role'],
        'rating'=>(float)($u['rating']??0),'client_uuid'=>(string)$u['client_uuid'],
        'avatar_url'=>(string)($u['avatar_url']??''),'full_name'=>(string)($u['full_name']??''),
        'phone'=>(string)($u['phone']??''),
        'max_contact'=>(string)($u['max_contact']??''),'vk_contact'=>(string)($u['vk_contact']??''),
        'telegram_contact'=>(string)($u['telegram_contact']??''),'bio'=>(string)($u['bio']??''),'is_online'=>(!empty($u['last_seen_at']) && strtotime((string)$u['last_seen_at'])>=time()-75)
    ];
}
function requireAuth(): int { if (!isset($_SESSION['user_id'])) out(['success'=>false,'error'=>'Требуется авторизация'],401); return (int)$_SESSION['user_id']; }
function avatarPathForId(int $id,string $old=''): string { return 'uploads/avatars/user_'.$id.'_'.bin2hex(random_bytes(6)); }
function saveAvatar(string $data,int $uid,string $oldPath,string $publicDir): string {
    if ($data==='') return $oldPath;
    if (strlen($data)>4*1024*1024) out(['success'=>false,'error'=>'Аватар слишком большой. Максимум 3 МБ.'],422);
    if (strpos($data,'data:image/')!==0) out(['success'=>false,'error'=>'Аватар должен быть JPG, PNG, WEBP или GIF.'],422);
    $parts=explode(',', $data,2); if(count($parts)!==2) out(['success'=>false,'error'=>'Некорректный файл аватара.'],422);
    $bin=base64_decode($parts[1],true); if($bin===false || strlen($bin)>3*1024*1024) out(['success'=>false,'error'=>'Аватар слишком большой или повреждён.'],422);
    $info=@getimagesizefromstring($bin); if(!$info) out(['success'=>false,'error'=>'Не удалось прочитать изображение.'],422);
    $mime=(string)($info['mime']??''); $ext=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','image/gif'=>'gif'][$mime]??null;
    if(!$ext) out(['success'=>false,'error'=>'Разрешены только JPG, PNG, WEBP и GIF.'],422);
    $dir=$publicDir.'/uploads/avatars'; if(!is_dir($dir) && !@mkdir($dir,0755,true)) out(['success'=>false,'error'=>'Не удалось создать папку аватаров.'],500);
    $name='user_'.$uid.'_'.bin2hex(random_bytes(8)).'.'.$ext; $path=$dir.'/'.$name;
    if(@file_put_contents($path,$bin,LOCK_EX)===false) out(['success'=>false,'error'=>'Не удалось сохранить аватар.'],500);
    if($oldPath && strpos($oldPath,'uploads/avatars/')===0){$old=$publicDir.'/'.$oldPath;if(is_file($old)) @unlink($old);}
    return 'uploads/avatars/'.$name;
}
function pickupRadius(): int { global $config; $r=(int)($config['rides']['pickup_radius_m'] ?? 150); return max(30,min(2000,$r)); }
function pickupGraceSeconds(): int { global $config; $g=(int)($config['rides']['pickup_force_after_sec'] ?? 180); return max(30,min(1800,$g)); }
function metersBetween(float $lat1,float $lng1,float $lat2,float $lng2): float {
    $R=6371000.0; $p1=deg2rad($lat1); $p2=deg2rad($lat2); $dp=deg2rad($lat2-$lat1); $dl=deg2rad($lng2-$lng1);
    $a=sin($dp/2)**2 + cos($p1)*cos($p2)*sin($dl/2)**2;
    return $R*2*atan2(sqrt($a),sqrt(1-$a));
}
function requirePickupSchema(PDO $pdo): void { if(!columnExists($pdo,'rides','pickup_requested_at')) out(['success'=>false,'error'=>'Не выполнена миграция migration_2026_09_beta_2_7.sql.'],500); }
function profileSelect(): string { return 'id,client_uuid,username,role,rating,avatar_url,full_name,phone,max_contact,vk_contact,telegram_contact,bio,created_at,updated_at,last_seen_at'; }
function serverData(PDO $pdo): array {
    $uid=(int)($_SESSION['user_id']??0);
    if($uid>0 && columnExists($pdo,'users','last_seen_at')) { try{$pdo->prepare('UPDATE users SET last_seen_at=? WHERE id=?')->execute([date('Y-m-d H:i:s'),$uid]);}catch(Throwable $e){} } $hasLoc=tableExists($pdo,'driver_locations'); $hasUserLoc=tableExists($pdo,'user_locations');
    $driverFields=$hasLoc ? "CASE WHEN r.user_id={$uid} OR r.driver_id={$uid} THEN dl.lat ELSE NULL END driver_lat, CASE WHEN r.user_id={$uid} OR r.driver_id={$uid} THEN dl.lng ELSE NULL END driver_lng, CASE WHEN r.user_id={$uid} OR r.driver_id={$uid} THEN dl.accuracy ELSE NULL END driver_accuracy, CASE WHEN r.user_id={$uid} OR r.driver_id={$uid} THEN dl.updated_at ELSE NULL END driver_location_updated_at" : 'NULL driver_lat,NULL driver_lng,NULL driver_accuracy,NULL driver_location_updated_at';
    $join=$hasLoc?' LEFT JOIN driver_locations dl ON dl.driver_id=r.driver_id ':'';
    $rides=$pdo->query("SELECT r.*,u.username passenger_name,u.rating passenger_rating,u.avatar_url passenger_avatar,u.full_name passenger_full_name,d.username driver_name,d.avatar_url driver_avatar,d.full_name driver_full_name,$driverFields FROM rides r JOIN users u ON r.user_id=u.id LEFT JOIN users d ON r.driver_id=d.id $join WHERE r.deleted_at IS NULL ORDER BY CASE WHEN r.user_id={$uid} THEN 0 ELSE 1 END, CASE WHEN r.status='pending' THEN 0 WHEN r.status='accepted' THEN 1 WHEN r.status='on_the_way' THEN 2 ELSE 3 END, r.updated_at DESC LIMIT 300")->fetchAll();
    $messages=[];
    if(tableExists($pdo,'chat_messages')){
        $hasRecipient=columnExists($pdo,'chat_messages','recipient_id');
        $recipient=$hasRecipient?"m.recipient_id":"NULL";
        $readAt=columnExists($pdo,'chat_messages','read_at')?'m.read_at':'NULL';
        $directWhere=$hasRecipient?"(m.ride_client_uuid='__direct__' AND (m.sender_id={$uid} OR m.recipient_id={$uid}))":"1=0";
        $messages=$pdo->query("SELECT m.id,m.client_uuid,m.ride_client_uuid,m.sender_id,$recipient recipient_id,m.message,m.created_at,$readAt read_at,u.username sender_name,u.avatar_url sender_avatar FROM chat_messages m JOIN users u ON m.sender_id=u.id WHERE m.deleted_at IS NULL AND (m.ride_client_uuid='__global__' OR $directWhere OR (m.ride_client_uuid<>'__global__' AND m.ride_client_uuid<>'__direct__' AND EXISTS (SELECT 1 FROM rides rr WHERE rr.client_uuid=m.ride_client_uuid AND rr.deleted_at IS NULL AND (rr.user_id={$uid} OR rr.driver_id={$uid})))) ORDER BY m.created_at ASC LIMIT 500")->fetchAll();
    }
    $unreadDirect=0; $unreadBooking=0;
    if($uid>0 && tableExists($pdo,'chat_messages') && columnExists($pdo,'chat_messages','recipient_id') && columnExists($pdo,'chat_messages','read_at')){
        $q=$pdo->prepare("SELECT COUNT(*) FROM chat_messages WHERE deleted_at IS NULL AND recipient_id=? AND read_at IS NULL AND ride_client_uuid='__direct__'");
        $q->execute([$uid]); $unreadDirect=(int)$q->fetchColumn();
        $q=$pdo->prepare("SELECT COUNT(*) FROM chat_messages WHERE deleted_at IS NULL AND recipient_id=? AND read_at IS NULL AND ride_client_uuid LIKE '__booking_%'");
        $q->execute([$uid]); $unreadBooking=(int)$q->fetchColumn();
    }
    $users=$pdo->query("SELECT ".profileSelect()." FROM users WHERE deleted_at IS NULL ORDER BY rating DESC,username ASC")->fetchAll();
    foreach($users as &$uu){ $seen=$uu['last_seen_at']??null; $uu['is_online']=($seen && strtotime((string)$seen)>=time()-75); $uu['rating']=(float)($uu['rating']??0); } unset($uu);
    $ratingRide=(tableExists($pdo,'ratings')&&columnExists($pdo,'ratings','ride_client_uuid'))?'ra.ride_client_uuid':"'' ride_client_uuid";
    $ratings=tableExists($pdo,'ratings')?$pdo->query("SELECT ra.id,ra.client_uuid,ra.from_user_id,ra.to_user_id,$ratingRide,ra.score,ra.review_text,ra.updated_at,fu.username from_username,tu.username to_username,fu.avatar_url from_avatar,tu.avatar_url to_avatar FROM ratings ra JOIN users fu ON fu.id=ra.from_user_id JOIN users tu ON tu.id=ra.to_user_id WHERE ra.deleted_at IS NULL ORDER BY ra.updated_at DESC LIMIT 500")->fetchAll():[];
    $trips=tableExists($pdo,'future_trips')?$pdo->query("SELECT t.*,u.username driver_name,u.rating driver_rating,u.avatar_url driver_avatar,(SELECT COUNT(*) FROM trip_bookings b WHERE b.trip_id=t.id AND b.status='booked') booked_seats FROM future_trips t JOIN users u ON t.driver_id=u.id WHERE t.status='open' AND t.departure_at>=NOW() ORDER BY t.departure_at ASC LIMIT 100")->fetchAll():[];
    $bookings=tableExists($pdo,'trip_bookings')?$pdo->query("SELECT b.*,t.departure_at,t.origin,t.destination,t.seats_total,t.driver_id,t.status trip_status,u.username driver_name,u.avatar_url driver_avatar FROM trip_bookings b JOIN future_trips t ON b.trip_id=t.id JOIN users u ON t.driver_id=u.id WHERE b.user_id={$uid} ORDER BY t.departure_at ASC")->fetchAll():[];
    $myPassengers=[]; $mapPassengers=[];
    $onlineIds=[]; foreach($users as $uu){ if(!empty($uu['is_online'])) $onlineIds[(int)$uu['id']]=true; }
    if($uid>0){
        $seen=[];
        foreach($rides as $r){ if((int)($r['driver_id']??0)===$uid && in_array($r['status'],['accepted','on_the_way'],true)){ $pid=(int)$r['user_id']; $key='ride:'.$r['client_uuid']; $seen[$key]=true; $myPassengers[]=['id'=>$pid,'username'=>$r['passenger_name'],'full_name'=>$r['passenger_full_name']??'','avatar_url'=>$r['passenger_avatar']??'','rating'=>(float)($r['passenger_rating']??0),'source'=>'Текущая поездка','route'=>trim((string)($r['pickup_address']??'')),'destination'=>trim((string)($r['destination_text']??'')),'status'=>$r['status'],'ride_uuid'=>$r['client_uuid'],'kind'=>'ride','is_online'=>isset($onlineIds[$pid]),'pickup_requested_at'=>$r['pickup_requested_at']??null,'pickup_confirmed_at'=>$r['pickup_confirmed_at']??null]; }}
        if(tableExists($pdo,'future_trips')&&tableExists($pdo,'trip_bookings')){
            $st=$pdo->prepare("SELECT b.id booking_id,b.status booking_status,b.created_at,t.id trip_id,t.origin,t.destination,t.departure_at,u.id passenger_id,u.username passenger_name,u.full_name passenger_full_name,u.avatar_url passenger_avatar,u.rating passenger_rating FROM trip_bookings b JOIN future_trips t ON t.id=b.trip_id JOIN users u ON u.id=b.user_id WHERE t.driver_id=? AND b.status='booked' AND t.departure_at>=NOW() ORDER BY t.departure_at ASC,b.created_at ASC");$st->execute([$uid]);
            foreach($st->fetchAll() as $b){$myPassengers[]=['id'=>(int)$b['passenger_id'],'username'=>$b['passenger_name'],'full_name'=>$b['passenger_full_name']??'','avatar_url'=>$b['passenger_avatar']??'','rating'=>(float)($b['passenger_rating']??0),'source'=>'Будущая поездка','route'=>trim((string)$b['origin']),'destination'=>trim((string)$b['destination']),'status'=>'booked','booking_id'=>(int)$b['booking_id'],'departure_at'=>$b['departure_at'],'kind'=>'booking','is_online'=>isset($onlineIds[(int)$b['passenger_id']])];}
        }
    }
    $mapDrivers=[];
    if($hasLoc){
        $st=$pdo->query("SELECT dl.driver_id,dl.lat,dl.lng,dl.accuracy,dl.updated_at,u.username,u.avatar_url,u.rating FROM driver_locations dl JOIN users u ON u.id=dl.driver_id WHERE u.deleted_at IS NULL AND u.role='driver' AND dl.updated_at>=DATE_SUB(NOW(),INTERVAL 120 SECOND)");
        foreach($st->fetchAll() as $d){$mapDrivers[]=['id'=>(int)$d['driver_id'],'username'=>$d['username'],'avatar_url'=>$d['avatar_url']??'','rating'=>(float)($d['rating']??0),'lat'=>(float)$d['lat'],'lng'=>(float)$d['lng'],'updated_at'=>$d['updated_at'],'accuracy'=>$d['accuracy']];}
    }
    if($uid>0 && $hasUserLoc){
        $st=$pdo->prepare("SELECT ul.user_id,ul.lat,ul.lng,ul.accuracy,ul.updated_at,u.username,u.avatar_url,u.rating FROM user_locations ul JOIN users u ON u.id=ul.user_id WHERE u.deleted_at IS NULL AND ul.updated_at>=?");
        $st->execute([date('Y-m-d H:i:s',time()-120)]); $locs=$st->fetchAll(); $allowed=array_map('intval',array_column($myPassengers,'id'));
        foreach($locs as $x){ if(!in_array((int)$x['user_id'],$allowed,true)) continue; $base=['source'=>'Пассажир']; foreach($myPassengers as $p){if((int)$p['id']===(int)$x['user_id']){$base=$p;break;}} $mapPassengers[]=['id'=>(int)$x['user_id'],'username'=>$x['username'],'avatar_url'=>$x['avatar_url']??'','rating'=>(float)($x['rating']??0),'lat'=>(float)$x['lat'],'lng'=>(float)$x['lng'],'updated_at'=>$x['updated_at'],'source'=>$base['source']??'Пассажир']; }
    }
    return ['ratings_per_ride'=>columnExists($pdo,'ratings','ride_client_uuid'),'pickup_flow_ready'=>columnExists($pdo,'rides','pickup_requested_at'),'pickup_radius_m'=>pickupRadius(),'pickup_force_after_sec'=>pickupGraceSeconds(),'rides'=>$rides,'chat_messages'=>$messages,'users'=>$users,'ratings'=>$ratings,'future_trips'=>$trips,'my_bookings'=>$bookings,'my_passengers'=>$myPassengers,'map_passengers'=>$mapPassengers,'map_drivers'=>$mapDrivers,'unread_direct'=>$unreadDirect,'unread_booking'=>$unreadBooking];
}

$action=(string)($_GET['action']??'');
if($action==='get_csrf') out(['success'=>true,'csrf_token'=>csrf()]);
$authAction=in_array($action,['register_login'],true);
if($_SERVER['REQUEST_METHOD']==='POST'&&!$authAction){$token=(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'');$sessionToken=csrf();if(!$token||!hash_equals($sessionToken,$token))out(['success'=>false,'error'=>'Недействительный CSRF токен. Обновите страницу и попробуйте снова.','csrf_token'=>$sessionToken],403);}
try{$dsn='mysql:host='.(string)$config['db']['host'].';port='.(int)$config['db']['port'].';dbname='.(string)$config['db']['dbname'].';charset='.(string)$config['db']['charset'];$pdo=new PDO($dsn,(string)$config['db']['user'],(string)$config['db']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);}
catch(Throwable $e){logPrivate('DB: '.$e->getMessage(),$runtimeDir);out(['success'=>false,'error'=>'Не удалось подключиться к базе данных. Проверьте настройки БД.'],500);}
if(!$authAction&&isset($_SESSION['user_id'])){try{$st=$pdo->prepare('SELECT auth_version FROM users WHERE id=? AND deleted_at IS NULL');$st->execute([$_SESSION['user_id']]);$u=$st->fetch();if(!$u||(int)$u['auth_version']!==(int)($_SESSION['auth_version']??0)){session_unset();session_destroy();out(['success'=>false,'error'=>'Сессия устарела. Войдите заново.'],401);}}catch(Throwable $e){logPrivate('SESSION: '.$e->getMessage(),$runtimeDir);out(['success'=>false,'error'=>'Ошибка проверки сессии.'],500);}}
$in=input(); $publicDir=dirname(__DIR__);

switch($action){
case 'get_session':
    if(!isset($_SESSION['user_id']))out(['success'=>true,'user'=>null,'csrf_token'=>csrf()]);
    $st=$pdo->prepare('SELECT '.profileSelect().' ,auth_version FROM users WHERE id=? AND deleted_at IS NULL');$st->execute([$_SESSION['user_id']]);$u=$st->fetch();if(!$u){session_unset();session_destroy();session_start();out(['success'=>true,'user'=>null,'csrf_token'=>csrf()]);}
    $_SESSION['role']=$u['role'];$_SESSION['auth_version']=(int)$u['auth_version'];out(['success'=>true,'user'=>publicUser($u),'csrf_token'=>csrf()]);
case 'register_login':
    $username=trim((string)($in['username']??''));$username=ltrim($username,'@');$password=(string)($in['password']??'');$mode=(string)($in['mode']??'login');
    if(!in_array($mode,['login','register'],true))out(['success'=>false,'error'=>'Некорректный режим.'],422);
    if($mode==='register'){
        if(empty($in['accepted_terms']))out(['success'=>false,'error'=>'Подтвердите принятие пользовательского соглашения и политики конфиденциальности.'],422);
        if(!preg_match('/^[A-Za-z0-9_]{4,32}$/',$username))out(['success'=>false,'error'=>'Юзернейм: 4–32 символа, только латинские буквы, цифры и _.'],422);
        if(strlen($password)<6)out(['success'=>false,'error'=>'Пароль: минимум 6 символов.'],422);
        $st=$pdo->prepare('SELECT id FROM users WHERE username=? AND deleted_at IS NULL');$st->execute([$username]);if($st->fetch())out(['success'=>false,'error'=>'Пользователь с таким именем уже существует.'],409);
        $clientUuid=uuid();$now=date('Y-m-d H:i:s');$hash=password_hash($password,PASSWORD_DEFAULT);
        try{$st=$pdo->prepare('INSERT INTO users (client_uuid,username,password_hash,role,auth_version,rating,created_at,updated_at) VALUES (?,?,?,?,1,0.00,?,?)');$st->execute([$clientUuid,$username,$hash,'passenger',$now,$now]);$userId=(int)$pdo->lastInsertId();}
        catch(Throwable $e){logPrivate('REGISTER: '.$e->getMessage(),$runtimeDir);out(['success'=>false,'error'=>'Не удалось создать аккаунт. Выполните migration_2026_09_v21.sql.'],500);}
        $st=$pdo->prepare('SELECT * FROM users WHERE id=?');$st->execute([$userId]);$user=$st->fetch();session_regenerate_id(true);$_SESSION['user_id']=$userId;$_SESSION['role']='passenger';$_SESSION['auth_version']=(int)$user['auth_version'];csrf();out(['success'=>true,'user'=>publicUser($user),'csrf_token'=>csrf(),'message'=>'Аккаунт создан.']);
    }
    if(!preg_match('/^.{3,100}$/u',$username)||strlen($password)<6)out(['success'=>false,'error'=>'Введите юзернейм и пароль.'],422);
    $st=$pdo->prepare('SELECT * FROM users WHERE username=? AND deleted_at IS NULL');$st->execute([$username]);$user=$st->fetch();
    if(!$user||!password_verify($password,(string)$user['password_hash']))out(['success'=>false,'error'=>'Неверное имя пользователя или пароль.'],401);
    session_regenerate_id(true);$_SESSION['user_id']=(int)$user['id'];$_SESSION['role']=(string)$user['role'];$_SESSION['auth_version']=(int)$user['auth_version'];csrf();out(['success'=>true,'user'=>publicUser($user),'csrf_token'=>csrf()]);
case 'switch_role':
    $uid=requireAuth();$st=$pdo->prepare('SELECT * FROM users WHERE id=? AND deleted_at IS NULL');$st->execute([$uid]);$user=$st->fetch();if(!$user||!in_array($user['role'],['passenger','driver'],true))out(['success'=>false,'error'=>'Смена роли недоступна.'],403);
    $newRole=$user['role']==='passenger'?'driver':'passenger';$newVersion=(int)$user['auth_version']+1;$st=$pdo->prepare('UPDATE users SET role=?,auth_version=?,updated_at=? WHERE id=? AND auth_version=?');$st->execute([$newRole,$newVersion,date('Y-m-d H:i:s'),$uid,$user['auth_version']]);if($st->rowCount()!==1)out(['success'=>false,'error'=>'Не удалось изменить роль. Повторите.'],409);
    if($newRole==='passenger'&&tableExists($pdo,'driver_locations'))$pdo->prepare('DELETE FROM driver_locations WHERE driver_id=?')->execute([$uid]);
    $_SESSION['role']=$newRole;$_SESSION['auth_version']=$newVersion;$user['role']=$newRole;$user['auth_version']=$newVersion;out(['success'=>true,'user'=>publicUser($user),'server_data'=>serverData($pdo),'csrf_token'=>csrf()]);
case 'logout': session_unset();session_destroy();out(['success'=>true]);
case 'save_profile':
    $uid=requireAuth();$st=$pdo->prepare('SELECT * FROM users WHERE id=? AND deleted_at IS NULL');$st->execute([$uid]);$user=$st->fetch();if(!$user)out(['success'=>false,'error'=>'Пользователь не найден.'],404);
    $newUsername=ltrim(trim((string)($in['username']??$user['username'])),'@');
    if(!preg_match('/^[A-Za-z0-9_]{4,32}$/',$newUsername))out(['success'=>false,'error'=>'Юзернейм: 4–32 символа, только латинские буквы, цифры и _.'],422);
    $st=$pdo->prepare('SELECT id FROM users WHERE username=? AND id<>? AND deleted_at IS NULL');$st->execute([$newUsername,$uid]);if($st->fetch())out(['success'=>false,'error'=>'Такое имя пользователя уже занято.'],409);
    $full=trim((string)($in['full_name']??''));$phone=trim((string)($in['phone']??''));$max=trim((string)($in['max_contact']??''));$vk=trim((string)($in['vk_contact']??''));$tg=trim((string)($in['telegram_contact']??''));$bio=trim((string)($in['bio']??''));
    $full=mb_substr($full,0,150);$phone=mb_substr($phone,0,50);$max=mb_substr($max,0,255);$vk=mb_substr($vk,0,255);$tg=mb_substr($tg,0,255);$bio=mb_substr($bio,0,500);
    try{$avatar=saveAvatar(trim((string)($in['avatar_data']??'')),$uid,(string)($user['avatar_url']??''),$publicDir);$st=$pdo->prepare('UPDATE users SET username=?,full_name=?,phone=?,max_contact=?,vk_contact=?,telegram_contact=?,bio=?,avatar_url=?,updated_at=? WHERE id=?');$st->execute([$newUsername,$full,$phone,$max,$vk,$tg,$bio,$avatar,date('Y-m-d H:i:s'),$uid]);$st=$pdo->prepare('SELECT '.profileSelect().' ,auth_version FROM users WHERE id=?');$st->execute([$uid]);$user=$st->fetch();}
    catch(Throwable $e){logPrivate('PROFILE: '.$e->getMessage(),$runtimeDir);out(['success'=>false,'error'=>'Не удалось сохранить профиль. Проверьте миграцию v9.'],500);}
    out(['success'=>true,'user'=>publicUser($user),'server_data'=>serverData($pdo),'csrf_token'=>csrf()]);
case 'get_user_profile':
    requireAuth();$target=(int)($in['user_id']??0);if($target<1)out(['success'=>false,'error'=>'Пользователь не найден.'],422);$st=$pdo->prepare('SELECT '.profileSelect().' FROM users WHERE id=? AND deleted_at IS NULL');$st->execute([$target]);$u=$st->fetch();if(!$u)out(['success'=>false,'error'=>'Пользователь не найден.'],404);
    $st=$pdo->prepare("SELECT r.*,u.username passenger_name,u.avatar_url passenger_avatar,d.username driver_name,d.avatar_url driver_avatar FROM rides r JOIN users u ON r.user_id=u.id LEFT JOIN users d ON r.driver_id=d.id WHERE r.deleted_at IS NULL AND (r.user_id=? OR r.driver_id=?) ORDER BY r.updated_at DESC LIMIT 100");$st->execute([$target,$target]);$ownRides=$st->fetchAll();
    $future=[];if(tableExists($pdo,'future_trips')){$st=$pdo->prepare("SELECT t.*,u.username driver_name,u.avatar_url driver_avatar,(SELECT COUNT(*) FROM trip_bookings b WHERE b.trip_id=t.id AND b.status='booked') booked_seats FROM future_trips t JOIN users u ON t.driver_id=u.id WHERE t.driver_id=? ORDER BY t.departure_at DESC LIMIT 100");$st->execute([$target]);$future=$st->fetchAll();}
    $reviews=[];$canRate=false;$myRating=null;$rateRide=null;$rateRides=[];$sharedRides=0;$ratedRides=0;$hasRideCol=columnExists($pdo,'ratings','ride_client_uuid');
    if(tableExists($pdo,'ratings')){$st=$pdo->prepare("SELECT ra.*,u.username from_username,u.avatar_url from_avatar FROM ratings ra JOIN users u ON u.id=ra.from_user_id WHERE ra.to_user_id=? AND ra.deleted_at IS NULL ORDER BY ra.updated_at DESC LIMIT 100");$st->execute([$target]);$reviews=$st->fetchAll();
      $me=(int)($_SESSION['user_id']??0);
      if($me!==$target){
        $hasRideCol=columnExists($pdo,'ratings','ride_client_uuid');
        if($hasRideCol){
          // BETA-2.7.6: раньше сервер выбирал ОДНУ поездку (rate_ride) и отдавал единственный
          // редактор отзыва на весь профиль, даже если совместных поездок было несколько.
          // Теперь отдаём rate_rides — по одной записи (и своему отзыву, если есть) на каждую
          // завершённую совместную поездку, чтобы фронтенд рисовал редактор для каждой из них.
          $wantRide=trim((string)($in['ride_client_uuid']??''));
          $st=$pdo->prepare("SELECT client_uuid,pickup_address,destination_text,updated_at FROM rides WHERE deleted_at IS NULL AND status='completed' AND ((user_id=? AND driver_id=?) OR (user_id=? AND driver_id=?)) ORDER BY updated_at DESC LIMIT 50");
          $st->execute([$me,$target,$target,$me]);$shared=$st->fetchAll();
          $st=$pdo->prepare("SELECT * FROM ratings WHERE from_user_id=? AND to_user_id=? AND deleted_at IS NULL");
          $st->execute([$me,$target]);$mineByRide=[];foreach($st->fetchAll() as $x){$mineByRide[(string)($x['ride_client_uuid']??'')]=$x;}
          foreach($shared as $r){
            $existing=$mineByRide[$r['client_uuid']]??null;
            $rateRides[]=['client_uuid'=>$r['client_uuid'],'label'=>trim((string)($r['destination_text']?:($r['pickup_address']?:'Поездка'))),'updated_at'=>$r['updated_at'],'my_rating'=>$existing?['score'=>(int)$existing['score'],'review_text'=>(string)$existing['review_text']]:null];
          }
          $canRate=count($shared)>0;
          $sharedRides=count($shared);$ratedRides=count($mineByRide);
          // rate_ride/my_rating оставлены только для обратной совместимости со старыми клиентами.
          $pick=null;
          if($wantRide)foreach($shared as $r){if($r['client_uuid']===$wantRide){$pick=$r;break;}}
          if(!$pick&&$shared)$pick=$shared[0];
          if($pick){$myRating=$mineByRide[$pick['client_uuid']]??null;$rateRide=['client_uuid'=>$pick['client_uuid'],'label'=>trim((string)($pick['destination_text']?:($pick['pickup_address']?:'Поездка'))),'updated_at'=>$pick['updated_at']];}
        } else {
          $st=$pdo->prepare("SELECT id FROM rides WHERE deleted_at IS NULL AND status='completed' AND ((user_id=? AND driver_id=?) OR (user_id=? AND driver_id=?)) LIMIT 1");$st->execute([$me,$target,$target,$me]);$canRate=(bool)$st->fetch();
          $st=$pdo->prepare("SELECT * FROM ratings WHERE from_user_id=? AND to_user_id=? AND deleted_at IS NULL LIMIT 1");$st->execute([$me,$target]);$myRating=$st->fetch()?:null;
        }
      }
    }
    out(['success'=>true,'profile'=>array_merge(publicUser($u),['is_online'=>(columnExists($pdo,'users','last_seen_at') && !empty($u['last_seen_at']) && strtotime((string)$u['last_seen_at'])>=time()-75)]),'rides'=>$ownRides,'future_trips'=>$future,'reviews'=>$reviews,'can_rate'=>$canRate,'my_rating'=>$myRating,'rate_ride'=>$rateRide,'rate_rides'=>$rateRides,'ratings_per_ride'=>$hasRideCol,'shared_rides'=>$sharedRides,'rated_rides'=>$ratedRides]);
case 'create_ride':
    $uid=requireAuth();if(($_SESSION['role']??'')!=='passenger')out(['success'=>false,'error'=>'Переключитесь в режим пассажира.'],403);$lat=(float)($in['lat']??0);$lng=(float)($in['lng']??0);$comment=trim((string)($in['comment']??''));$uuidIn=trim((string)($in['client_uuid']??''));$destinationText=trim((string)($in['destination_text']??''));$destinationLat=isset($in['destination_lat'])?(float)$in['destination_lat']:null;$destinationLng=isset($in['destination_lng'])?(float)$in['destination_lng']:null;if(!$uuidIn||strlen($uuidIn)>36||$lat<-90||$lat>90||$lng<-180||$lng>180||$destinationLat===null||$destinationLng===null||$destinationLat<-90||$destinationLat>90||$destinationLng<-180||$destinationLng>180)out(['success'=>false,'error'=>'Укажите место посадки и точку назначения на карте.'],422);
    // BETA-2.7.5: повторные нажатия на «Создать заявку» больше не плодят дубли.
    $st=$pdo->prepare("SELECT client_uuid FROM rides WHERE user_id=? AND deleted_at IS NULL AND status IN ('pending','accepted','on_the_way') LIMIT 1");$st->execute([$uid]);
    if($st->fetch())out(['success'=>false,'error'=>'У вас уже есть активная заявка. Завершите или отмените её, прежде чем создавать новую.','server_data'=>serverData($pdo)],409);
    try{$st=$pdo->prepare('INSERT INTO rides (client_uuid,user_id,driver_id,lat,lng,pickup_address,destination_lat,destination_lng,destination_text,comment,status,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL)');$st->execute([$uuidIn,$uid,null,$lat,$lng,trim((string)($in['pickup_address']??'')),$destinationLat,$destinationLng,$destinationText,$comment,'pending',date('Y-m-d H:i:s')]);}catch(Throwable $e){logPrivate('CREATE RIDE: '.$e->getMessage(),$runtimeDir);out(['success'=>false,'error'=>'Не удалось создать заявку. Проверьте миграцию v8.'],500);}out(['success'=>true,'server_data'=>serverData($pdo)]);
case 'ride_status':
    $uid=requireAuth();$uuidIn=trim((string)($in['client_uuid']??''));$new=(string)($in['status']??'');if(!$uuidIn||!in_array($new,['accepted','completed','cancelled'],true))out(['success'=>false,'error'=>'Недопустимый статус. Начало поездки идёт через подтверждение подбора.'],422);$st=$pdo->prepare('SELECT * FROM rides WHERE client_uuid=? AND deleted_at IS NULL');$st->execute([$uuidIn]);$ride=$st->fetch();if(!$ride)out(['success'=>false,'error'=>'Поездка не найдена.'],404);$now=date('Y-m-d H:i:s');
    if($new==='accepted'){if(($_SESSION['role']??'')!=='driver'||(int)$ride['user_id']===$uid)out(['success'=>false,'error'=>'Нужен режим водителя.'],403);$st=$pdo->prepare("UPDATE rides SET driver_id=?,status='accepted',updated_at=? WHERE client_uuid=? AND status='pending' AND deleted_at IS NULL AND user_id<>?");$st->execute([$uid,$now,$uuidIn,$uid]);if($st->rowCount()!==1)out(['success'=>false,'error'=>'Этого пассажира уже забрал другой водитель.'],409);}
    elseif($new==='completed'){if((int)$ride['user_id']!==$uid&&(int)$ride['driver_id']!==$uid)out(['success'=>false,'error'=>'Нет доступа.'],403);$pdo->prepare("UPDATE rides SET status='completed',updated_at=? WHERE client_uuid=?")->execute([$now,$uuidIn]);if(tableExists($pdo,'driver_locations')&&$ride['driver_id'])$pdo->prepare('DELETE FROM driver_locations WHERE driver_id=?')->execute([(int)$ride['driver_id']]);}
    else{if((int)$ride['user_id']!==$uid&&(int)$ride['driver_id']!==$uid)out(['success'=>false,'error'=>'Нет доступа.'],403);$pdo->prepare("UPDATE rides SET status='cancelled',deleted_at=?,updated_at=? WHERE client_uuid=?")->execute([$now,$now,$uuidIn]);if(tableExists($pdo,'driver_locations')&&$ride['driver_id'])$pdo->prepare('DELETE FROM driver_locations WHERE driver_id=?')->execute([(int)$ride['driver_id']]);}
    out(['success'=>true,'server_data'=>serverData($pdo),'csrf_token'=>csrf()]);
case 'update_driver_location':
    $uid=requireAuth();if(!tableExists($pdo,'driver_locations'))out(['success'=>false,'error'=>'Не установлена таблица геолокации водителей. Выполните migration_2026_09_v9.sql.'],500);if(($_SESSION['role']??'')!=='driver')out(['success'=>false,'error'=>'Переключитесь в режим водителя.'],403);$lat=(float)($in['lat']??0);$lng=(float)($in['lng']??0);$accuracy=isset($in['accuracy'])?(float)$in['accuracy']:null;if($lat<-90||$lat>90||$lng<-180||$lng>180)out(['success'=>false,'error'=>'Некорректные координаты.'],422);// Driver may stay visible on the map while online; active ride is no longer required for location updates.
$now=date('Y-m-d H:i:s');$st=$pdo->prepare('INSERT INTO driver_locations (driver_id,lat,lng,accuracy,updated_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE lat=VALUES(lat),lng=VALUES(lng),accuracy=VALUES(accuracy),updated_at=VALUES(updated_at)');$st->execute([$uid,$lat,$lng,$accuracy,$now]);out(['success'=>true,'location'=>['lat'=>$lat,'lng'=>$lng,'accuracy'=>$accuracy,'updated_at'=>$now]]);
case 'clear_driver_location': $uid=requireAuth();if(!tableExists($pdo,'driver_locations'))out(['success'=>true]);$pdo->prepare('DELETE FROM driver_locations WHERE driver_id=?')->execute([$uid]);out(['success'=>true]);
case 'create_future_trip':
    $uid=requireAuth();
    if(!tableExists($pdo,'future_trips'))out(['success'=>false,'error'=>'Не установлена таблица будущих поездок. Выполните migration_2026_09_beta_2_8.sql.'],500);
    if(($_SESSION['role']??'')!=='driver')out(['success'=>false,'error'=>'Переключитесь в режим водителя.'],403);
    $origin=trim((string)($in['origin']??''));$destination=trim((string)($in['destination']??''));$departure=trim((string)($in['departure_at']??''));$seats=(int)($in['seats_total']??1);
    $lat=isset($in['origin_lat'])?(float)$in['origin_lat']:null;$lng=isset($in['origin_lng'])?(float)$in['origin_lng']:null;$dlat=isset($in['destination_lat'])?(float)$in['destination_lat']:null;$dlng=isset($in['destination_lng'])?(float)$in['destination_lng']:null;
    if($origin===''||$destination===''||$seats<1||$seats>4||$departure==='')out(['success'=>false,'error'=>'Заполните маршрут, время и количество мест (1–4).'],422);
    if($lat!==null&&($lat<-90||$lat>90)||$lng!==null&&($lng<-180||$lng>180)||$dlat!==null&&($dlat<-90||$dlat>90)||$dlng!==null&&($dlng<-180||$dlng>180))out(['success'=>false,'error'=>'Некорректные координаты точки поездки.'],422);
    $ts=strtotime($departure);if($ts===false||$ts<=time())out(['success'=>false,'error'=>'Дата и время выезда должны быть в будущем.'],422);
    $repeatWeeks=max(1,min(12,(int)($in['repeat_weeks']??1)));
    $recurring=columnExists($pdo,'future_trips','repeat_group');
if($repeatWeeks>1&&!$recurring){
  try{
    $pdo->exec("ALTER TABLE future_trips ADD COLUMN repeat_group VARCHAR(80) NULL");
    try{$pdo->exec("CREATE INDEX idx_future_repeat_group ON future_trips (repeat_group)");}catch(Throwable $ignore){}
    $recurring=columnExists($pdo,'future_trips','repeat_group');
  }catch(Throwable $ignore){}
  if(!$recurring){
    out(['success'=>false,'error'=>'Не удалось включить повторяющиеся поездки. Проверьте права базы данных.'],500);
  }
}
    $tripComment=mb_substr(trim((string)($in['comment']??'')),0,500);$now=date('Y-m-d H:i:s');$created=0;$group=$repeatWeeks>1?sprintf('rt_%s_%s',date('YmdHis'),bin2hex(random_bytes(5))):null;
    try{$pdo->beginTransaction();$items=[];$base=new DateTime($departure);
      if($repeatWeeks>1){for($w=0;$w<$repeatWeeks;$w++){$d=(clone $base)->modify("+{$w} weeks");$items[]=$d->format('Y-m-d H:i:s');}}else{$items[]=$base->format('Y-m-d H:i:s');}
      $sql=$recurring?'INSERT INTO future_trips (driver_id,origin,destination,origin_lat,origin_lng,destination_lat,destination_lng,departure_at,seats_total,price,comment,status,repeat_group,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)':'INSERT INTO future_trips (driver_id,origin,destination,origin_lat,origin_lng,destination_lat,destination_lng,departure_at,seats_total,price,comment,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
      $st=$pdo->prepare($sql);foreach($items as $when){$params=[$uid,$origin,$destination,$lat,$lng,$dlat,$dlng,$when,$seats,0,$tripComment,'open'];if($recurring)$params[]=$group;$params[]=$now;$params[]=$now;$st->execute($params);$created++;}if(!$created)throw new RuntimeException('Не удалось сформировать даты повторения. Выберите будущую дату.');$pdo->commit();
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();logPrivate('CREATE FUTURE TRIP: '.$e->getMessage(),$runtimeDir);out(['success'=>false,'error'=>$e->getMessage()==='Не удалось сформировать даты повторения. Выберите будущую дату.'?$e->getMessage():'Не удалось создать поездку.'],500);}
    out(['success'=>true,'created_count'=>$created,'repeat_group'=>$group,'server_data'=>serverData($pdo)]);
case 'cancel_future_trip':
    $uid=requireAuth();
    if(!tableExists($pdo,'future_trips'))out(['success'=>false,'error'=>'Не установлена таблица будущих поездок.'],500);
    $tripId=(int)($in['trip_id']??0);
    if($tripId<1)out(['success'=>false,'error'=>'Поездка не найдена.'],422);
    try{
        $pdo->beginTransaction();
        $st=$pdo->prepare("SELECT id FROM future_trips WHERE id=? AND driver_id=? AND status='open' LIMIT 1");
        $st->execute([$tripId,$uid]);
        if(!$st->fetch())throw new RuntimeException('Будущая поездка не найдена или уже отменена.');
        $now=date('Y-m-d H:i:s');
        $st=$pdo->prepare("UPDATE future_trips SET status='cancelled',updated_at=? WHERE id=? AND driver_id=? AND status='open'");
        $st->execute([$now,$tripId,$uid]);
        if(tableExists($pdo,'trip_bookings')){
            $st=$pdo->prepare("UPDATE trip_bookings SET status='cancelled',updated_at=? WHERE trip_id=? AND status='booked'");
            $st->execute([$now,$tripId]);
        }
        $pdo->commit();
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();out(['success'=>false,'error'=>$e->getMessage()],409);}
    out(['success'=>true,'server_data'=>serverData($pdo),'csrf_token'=>csrf()]);
case 'book_trip':
    $uid=requireAuth();if(!tableExists($pdo,'trip_bookings')||!tableExists($pdo,'future_trips'))out(['success'=>false,'error'=>'Не установлены таблицы бронирования. Выполните migration_2026_09_v9.sql.'],500);
    $tripId=(int)($in['trip_id']??0);if($tripId<1)out(['success'=>false,'error'=>'Поездка не найдена.'],422);
    try{
        $pdo->beginTransaction();
        $st=$pdo->prepare("SELECT t.*, (SELECT COUNT(*) FROM trip_bookings b WHERE b.trip_id=t.id AND b.status='booked') booked_seats FROM future_trips t WHERE t.id=? AND t.status='open' AND t.departure_at>=NOW() FOR UPDATE");$st->execute([$tripId]);$trip=$st->fetch();
        if(!$trip)throw new RuntimeException('Эта поездка уже недоступна.');
        if((int)$trip['driver_id']===$uid)throw new RuntimeException('Нельзя бронировать место в своей поездке.');
        if((int)$trip['booked_seats']>=(int)$trip['seats_total'])throw new RuntimeException('Свободных мест больше нет.');
        $st=$pdo->prepare('SELECT id,status FROM trip_bookings WHERE trip_id=? AND user_id=? LIMIT 1');$st->execute([$tripId,$uid]);$old=$st->fetch();
        if($old&&$old['status']==='booked')throw new RuntimeException('Вы уже забронировали место.');
        $now=date('Y-m-d H:i:s');
        if($old){$st=$pdo->prepare("UPDATE trip_bookings SET status='booked',updated_at=? WHERE id=?");$st->execute([$now,$old['id']]);$bookingId=(int)$old['id'];}
        else{$st=$pdo->prepare("INSERT INTO trip_bookings (trip_id,user_id,status,created_at,updated_at) VALUES (?,?, 'booked',?,?)");$st->execute([$tripId,$uid,$now,$now]);$bookingId=(int)$pdo->lastInsertId();}
        // BETA-2.10: водитель получает обычное личное сообщение о новой брони.
        // Ошибка чата не должна отменять уже созданную бронь.
        if(tableExists($pdo,'chat_messages')&&columnExists($pdo,'chat_messages','recipient_id')){
            try{
                $message='[URFU_BOOKING] Пассажир забронировал место в вашей поездке: '.(string)($trip['origin']??'').' → '.(string)($trip['destination']??'').'.';
                $st=$pdo->prepare("INSERT INTO chat_messages (client_uuid,ride_client_uuid,sender_id,recipient_id,message,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,NULL)");
                $st->execute([uuid(),'__direct__',$uid,(int)$trip['driver_id'],$message,$now,$now]);
            }catch(Throwable $messageError){ logPrivate('BOOKING MESSAGE: '.$messageError->getMessage(),$runtimeDir); }
        }
        $pdo->commit();
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();out(['success'=>false,'error'=>$e->getMessage()],409);}
    out(['success'=>true,'booking_id'=>$bookingId,'server_data'=>serverData($pdo),'csrf_token'=>csrf()]);
case 'cancel_booking':
    $uid=requireAuth();if(!tableExists($pdo,'trip_bookings'))out(['success'=>false,'error'=>'Не установлена таблица бронирования. Выполните migration_2026_09_v9.sql.'],500);$bookingId=(int)($in['booking_id']??0);$st=$pdo->prepare("UPDATE trip_bookings SET status='cancelled',updated_at=? WHERE id=? AND user_id=? AND status='booked'");$st->execute([date('Y-m-d H:i:s'),$bookingId,$uid]);if($st->rowCount()!==1)out(['success'=>false,'error'=>'Бронь не найдена или уже отменена.'],404);out(['success'=>true,'server_data'=>serverData($pdo)]);
case 'mark_chat_read':
    $uid=requireAuth(); if(!tableExists($pdo,'chat_messages')||!columnExists($pdo,'chat_messages','read_at'))out(['success'=>true,'server_data'=>serverData($pdo)]);
    $kind=(string)($in['kind']??'direct'); $target=(int)($in['user_id']??0); $bookingId=(int)($in['booking_id']??0);
    if($kind==='direct' && $target>0){$st=$pdo->prepare("UPDATE chat_messages SET read_at=? WHERE recipient_id=? AND sender_id=? AND ride_client_uuid='__direct__' AND read_at IS NULL");$st->execute([date('Y-m-d H:i:s'),$uid,$target]);}
    elseif($kind==='booking' && $bookingId>0){$st=$pdo->prepare("UPDATE chat_messages m JOIN trip_bookings b ON CONCAT('__booking_',b.id)=m.ride_client_uuid JOIN future_trips t ON t.id=b.trip_id SET m.read_at=? WHERE b.id=? AND (b.user_id=? OR t.driver_id=?) AND m.recipient_id=? AND m.read_at IS NULL");$st->execute([date('Y-m-d H:i:s'),$bookingId,$uid,$uid,$uid]);}
    out(['success'=>true,'server_data'=>serverData($pdo)]);
case 'send_message':
    $uid=requireAuth();if(!tableExists($pdo,'chat_messages'))out(['success'=>false,'error'=>'Не установлена таблица чата. Выполните migration_2026_09_v9.sql.'],500);$uuidIn=trim((string)($in['client_uuid']??''));$rideUuid=trim((string)($in['ride_client_uuid']??''));$recipient=(int)($in['recipient_id']??0);$msg=trim((string)($in['message']??''));if(!$uuidIn||$msg==='')out(['success'=>false,'error'=>'Пустое сообщение.'],422);$msg=mb_substr($msg,0,2000);
    if($rideUuid==='__direct__'){if($recipient<1||$recipient===$uid)out(['success'=>false,'error'=>'Выберите другого пользователя.'],422);$st=$pdo->prepare('SELECT id FROM users WHERE id=? AND deleted_at IS NULL');$st->execute([$recipient]);if(!$st->fetch())out(['success'=>false,'error'=>'Пользователь не найден.'],404);}
    elseif(str_starts_with($rideUuid,'__booking_')){$bid=(int)substr($rideUuid,10);$st=$pdo->prepare('SELECT b.user_id,t.driver_id FROM trip_bookings b JOIN future_trips t ON t.id=b.trip_id WHERE b.id=?');$st->execute([$bid]);$bk=$st->fetch();if(!$bk||((int)$bk['user_id']!==$uid&&(int)$bk['driver_id']!==$uid))out(['success'=>false,'error'=>'Нет доступа к чату брони.'],403);$recipient=(int)$bk['user_id']===$uid?(int)$bk['driver_id']:(int)$bk['user_id'];}
    elseif($rideUuid!=='__global__'){$st=$pdo->prepare('SELECT user_id,driver_id FROM rides WHERE client_uuid=? AND deleted_at IS NULL');$st->execute([$rideUuid]);$ride=$st->fetch();if(!$ride||((int)$ride['user_id']!==$uid&&(int)$ride['driver_id']!==$uid))out(['success'=>false,'error'=>'Нет доступа к чату.'],403);$recipient=(int)$ride['user_id']===$uid?(int)$ride['driver_id']:(int)$ride['user_id'];}
    try{$now=date('Y-m-d H:i:s');$hasRecipient=columnExists($pdo,'chat_messages','recipient_id');if($hasRecipient){$st=$pdo->prepare('INSERT INTO chat_messages (client_uuid,ride_client_uuid,sender_id,recipient_id,message,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,NULL)');$st->execute([$uuidIn,$rideUuid?:'__global__',$uid,$recipient?:null,$msg,$now,$now]);}else{$st=$pdo->prepare('INSERT INTO chat_messages (client_uuid,ride_client_uuid,sender_id,message,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,NULL)');$st->execute([$uuidIn,$rideUuid?:'__global__',$uid,$msg,$now,$now]);}}
    catch(Throwable $e){logPrivate('MESSAGE: '.$e->getMessage(),$runtimeDir);out(['success'=>false,'error'=>'Не удалось отправить сообщение. Выполните миграцию v9.'],500);}out(['success'=>true,'server_data'=>serverData($pdo),'csrf_token'=>csrf()]);
case 'delete_rating':
    $uid=requireAuth();if(!tableExists($pdo,'ratings'))out(['success'=>false,'error'=>'Таблица рейтингов не установлена.'],500);
    $target=(int)($in['to_user_id']??0);$rideUuid=trim((string)($in['ride_client_uuid']??''));
    if($target<1)out(['success'=>false,'error'=>'Пользователь не найден.'],422);
    // Удаляем физически: на (from,to,ride) висит UNIQUE, и мягко удалённая строка
    // не дала бы оставить новый отзыв за ту же поездку.
    if(columnExists($pdo,'ratings','ride_client_uuid') && $rideUuid){
        $st=$pdo->prepare('DELETE FROM ratings WHERE from_user_id=? AND to_user_id=? AND ride_client_uuid=?');$st->execute([$uid,$target,$rideUuid]);
    } else {
        $st=$pdo->prepare('DELETE FROM ratings WHERE from_user_id=? AND to_user_id=?');$st->execute([$uid,$target]);
    }
    if(!$st->rowCount())out(['success'=>false,'error'=>'Отзыв не найден.'],404);
    $now=date('Y-m-d H:i:s');
    $q=$pdo->prepare("SELECT COALESCE(AVG(score),0) FROM ratings WHERE to_user_id=? AND deleted_at IS NULL");$q->execute([$target]);$avg=round((float)$q->fetchColumn(),2);
    $pdo->prepare('UPDATE users SET rating=?,updated_at=? WHERE id=?')->execute([$avg,$now,$target]);
    out(['success'=>true,'server_data'=>serverData($pdo)]);

case 'save_rating':
    $uid=requireAuth();if(!tableExists($pdo,'ratings'))out(['success'=>false,'error'=>'Не установлена таблица рейтингов. Выполните migration_2026_09_v11.sql.'],500);
    $target=(int)($in['to_user_id']??0);$score=(int)($in['score']??0);$review=trim((string)($in['review_text']??''));
    if($target<1||$target===$uid||$score<1||$score>5)out(['success'=>false,'error'=>'Укажите рейтинг от 1 до 5.'],422);
    $review=mb_substr($review,0,1000);$now=date('Y-m-d H:i:s');
    $hasRideCol=columnExists($pdo,'ratings','ride_client_uuid');
    $rideUuid=trim((string)($in['ride_client_uuid']??''));
    if($hasRideCol){
        // BETA-2.7.4: отзыв пишется на конкретную завершённую поездку.
        if($rideUuid){
            $st=$pdo->prepare("SELECT client_uuid FROM rides WHERE client_uuid=? AND deleted_at IS NULL AND status='completed' AND ((user_id=? AND driver_id=?) OR (user_id=? AND driver_id=?)) LIMIT 1");
            $st->execute([$rideUuid,$uid,$target,$target,$uid]);
            if(!$st->fetch())out(['success'=>false,'error'=>'Поездка не найдена или ещё не завершена.'],403);
        } else {
            $st=$pdo->prepare("SELECT r.client_uuid FROM rides r WHERE r.deleted_at IS NULL AND r.status='completed' AND ((r.user_id=? AND r.driver_id=?) OR (r.user_id=? AND r.driver_id=?)) AND NOT EXISTS (SELECT 1 FROM ratings ra WHERE ra.from_user_id=? AND ra.to_user_id=? AND ra.ride_client_uuid=r.client_uuid AND ra.deleted_at IS NULL) ORDER BY r.updated_at DESC LIMIT 1");
            $st->execute([$uid,$target,$target,$uid,$uid,$target]);
            $row=$st->fetch();
            if(!$row)out(['success'=>false,'error'=>'Все завершённые поездки с этим пользователем уже оценены.'],409);
            $rideUuid=(string)$row['client_uuid'];
        }
        $st=$pdo->prepare('SELECT id FROM ratings WHERE from_user_id=? AND to_user_id=? AND ride_client_uuid=? AND deleted_at IS NULL LIMIT 1');
        $st->execute([$uid,$target,$rideUuid]);$old=$st->fetch();
        if($old){$pdo->prepare('UPDATE ratings SET score=?,review_text=?,updated_at=? WHERE id=?')->execute([$score,$review,$now,$old['id']]);}
        else{$pdo->prepare('INSERT INTO ratings (client_uuid,from_user_id,to_user_id,ride_client_uuid,score,review_text,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,NULL)')->execute([uuid(),$uid,$target,$rideUuid,$score,$review,$now]);}
    } else {
        $st=$pdo->prepare("SELECT id FROM rides WHERE deleted_at IS NULL AND status='completed' AND ((user_id=? AND driver_id=?) OR (user_id=? AND driver_id=?)) LIMIT 1");
        $st->execute([$uid,$target,$target,$uid]);
        if(!$st->fetch())out(['success'=>false,'error'=>'Оценить можно только пользователя, с которым была завершённая поездка.'],403);
        $st=$pdo->prepare('SELECT id FROM ratings WHERE from_user_id=? AND to_user_id=? AND deleted_at IS NULL LIMIT 1');
        $st->execute([$uid,$target]);$old=$st->fetch();
        if($old){$pdo->prepare('UPDATE ratings SET score=?,review_text=?,updated_at=? WHERE id=?')->execute([$score,$review,$now,$old['id']]);}
        else{$pdo->prepare('INSERT INTO ratings (client_uuid,from_user_id,to_user_id,score,review_text,updated_at,deleted_at) VALUES (?,?,?,?,?,?,NULL)')->execute([uuid(),$uid,$target,$score,$review,$now]);}
    }
    $st=$pdo->prepare("SELECT COALESCE(AVG(score),0) FROM ratings WHERE to_user_id=? AND deleted_at IS NULL");$st->execute([$target]);$avg=round((float)$st->fetchColumn(),2);
    $pdo->prepare('UPDATE users SET rating=?,updated_at=? WHERE id=?')->execute([$avg,$now,$target]);
    out(['success'=>true,'server_data'=>serverData($pdo)]);
case 'update_user_location':
    $uid=requireAuth(); if(!tableExists($pdo,'user_locations'))out(['success'=>false,'error'=>'Не установлена таблица геолокации пользователей. Выполните migration_2026_09_v15.sql.'],500);
    $lat=(float)($in['lat']??0);$lng=(float)($in['lng']??0);$accuracy=isset($in['accuracy'])?(float)$in['accuracy']:null; if($lat<-90||$lat>90||$lng<-180||$lng>180)out(['success'=>false,'error'=>'Некорректные координаты.'],422);
    $now=date('Y-m-d H:i:s');$st=$pdo->prepare('INSERT INTO user_locations (user_id,lat,lng,accuracy,updated_at) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE lat=VALUES(lat),lng=VALUES(lng),accuracy=VALUES(accuracy),updated_at=VALUES(updated_at)');$st->execute([$uid,$lat,$lng,$accuracy,$now]); if(columnExists($pdo,'users','last_seen_at'))$pdo->prepare('UPDATE users SET last_seen_at=? WHERE id=?')->execute([$now,$uid]); out(['success'=>true]);
case 'clear_user_location':
    $uid=requireAuth(); if(tableExists($pdo,'user_locations'))$pdo->prepare('DELETE FROM user_locations WHERE user_id=?')->execute([$uid]); out(['success'=>true]);
case 'ai_map_command':
    $uid=requireAuth();
    $query=trim((string)($in['query']??''));
    if($query==='')out(['success'=>false,'error'=>'Напишите запрос для карты.'],422);
    if(mb_strlen($query)>600)out(['success'=>false,'error'=>'Запрос слишком длинный.'],422);
    $apiKey=trim((string)($config['gemini']['api_key']??''));
    $model=trim((string)($config['gemini']['model']??'gemini-2.5-flash'));
    if($apiKey==='')out(['success'=>false,'error'=>'Gemini API key не настроен на сервере.'],500);
    $payload=[
      'system_instruction'=>['parts'=>[['text'=>'Ты помощник карты сервиса URFU4TOUR. По русскому запросу пользователя определи, какие адреса нужно поставить на карту. Верни ТОЛЬКО JSON по заданной схеме. pickup — место посадки, destination — место назначения. Если пользователь явно говорит только об одном месте, заполни pickup. Не выдумывай точные номера домов, которых нет в запросе; для известных мест используй понятное полное название и город Екатеринбург.']]],
      'contents'=>[['role'=>'user','parts'=>[['text'=>$query]]]],
      'generationConfig'=>[
        'temperature'=>0.1,
        'responseMimeType'=>'application/json',
        'responseSchema'=>[
          'type'=>'OBJECT','properties'=>[
            'pickup'=>['type'=>'STRING','nullable'=>true],
            'destination'=>['type'=>'STRING','nullable'=>true],
            'message'=>['type'=>'STRING']
          ],'required'=>['pickup','destination','message']
        ]
      ]
    ];
    $url='https://generativelanguage.googleapis.com/v1beta/models/'.rawurlencode($model).':generateContent?key='.rawurlencode($apiKey);
    $raw=false;$http=0;$err='';
    if(function_exists('curl_init')){
      $ch=curl_init($url);curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>25]);$raw=curl_exec($ch);$http=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$err=(string)curl_error($ch);curl_close($ch);
    }else{
      $ctx=stream_context_create(['http'=>['method'=>'POST','header'=>"Content-Type: application/json\r\n",'content'=>json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),'timeout'=>25,'ignore_errors'=>true]]);$raw=@file_get_contents($url,false,$ctx);$statusLine=(string)($http_response_header[0]??'');$http=preg_match('/\s(\d{3})\s/', $statusLine, $mm)?(int)$mm[1]:0;
    }
    if($raw===false||$raw===''){logPrivate('GEMINI: request failed http='.$http.' error='.$err,$runtimeDir);out(['success'=>false,'error'=>'Не удалось связаться с Gemini.'],502);}
    $response=json_decode($raw,true);
    if($http<200||$http>=300){$msg=(string)($response['error']['message']??'Gemini API error');logPrivate('GEMINI HTTP '.$http.': '.mb_substr($msg,0,500),$runtimeDir);out(['success'=>false,'error'=>'Gemini отклонил запрос: '.$msg],502);}
    $text=(string)($response['candidates'][0]['content']['parts'][0]['text']??'');$command=json_decode($text,true);
    if(!is_array($command)){logPrivate('GEMINI PARSE: '.mb_substr($text,0,500),$runtimeDir);out(['success'=>false,'error'=>'Gemini вернул некорректный ответ.'],502);}
    $pickup=trim((string)($command['pickup']??''));$destination=trim((string)($command['destination']??''));
    if($pickup==='')$pickup=null;if($destination==='')$destination=null;
    if($pickup===null&&$destination===null)out(['success'=>false,'error'=>'Не удалось определить адрес из запроса. Уточните место.'],422);
    out(['success'=>true,'command'=>['pickup'=>$pickup,'destination'=>$destination,'message'=>trim((string)($command['message']??''))]]);
case 'request_pickup':
    $uid=requireAuth();requirePickupSchema($pdo);
    if(($_SESSION['role']??'')!=='driver')out(['success'=>false,'error'=>'Нужен режим водителя.'],403);
    $uuidIn=trim((string)($in['client_uuid']??''));if(!$uuidIn)out(['success'=>false,'error'=>'Не указана поездка.'],422);
    $st=$pdo->prepare("SELECT * FROM rides WHERE client_uuid=? AND deleted_at IS NULL");$st->execute([$uuidIn]);$ride=$st->fetch();
    if(!$ride||(int)$ride['driver_id']!==$uid)out(['success'=>false,'error'=>'Поездка не найдена.'],404);
    if($ride['status']!=='accepted')out(['success'=>false,'error'=>'Поездку нужно сначала принять.'],409);
    $radius=pickupRadius();$driverPos=null;
    if(tableExists($pdo,'driver_locations')){
        $q=$pdo->prepare('SELECT lat,lng,updated_at FROM driver_locations WHERE driver_id=?');$q->execute([$uid]);$driverPos=$q->fetch()?:null;
        if($driverPos && strtotime((string)$driverPos['updated_at']) < time()-180) $driverPos=null; // позиция протухла — не блокируем
    }
    if(is_array($driverPos)){
        $dist=metersBetween((float)$driverPos['lat'],(float)$driverPos['lng'],(float)$ride['lat'],(float)$ride['lng']);
        $allowed=$radius + (float)($in['accuracy']??0);
        if($dist>$allowed)out(['success'=>false,'error'=>'До места посадки ещё '.round($dist).' м. Подтвердить подбор можно в радиусе '.$radius.' м.','distance_m'=>round($dist)],409);
    }
    $now=date('Y-m-d H:i:s');
    $pdo->prepare("UPDATE rides SET pickup_requested_at=?,updated_at=? WHERE client_uuid=? AND driver_id=? AND status='accepted'")->execute([$now,$now,$uuidIn,$uid]);
    out(['success'=>true,'server_data'=>serverData($pdo)]);

case 'cancel_pickup_request':
    $uid=requireAuth();requirePickupSchema($pdo);
    $uuidIn=trim((string)($in['client_uuid']??''));$now=date('Y-m-d H:i:s');
    $st=$pdo->prepare("SELECT user_id,driver_id,status FROM rides WHERE client_uuid=? AND deleted_at IS NULL");$st->execute([$uuidIn]);$ride=$st->fetch();
    if(!$ride)out(['success'=>false,'error'=>'Поездка не найдена.'],404);
    if((int)$ride['user_id']!==$uid&&(int)$ride['driver_id']!==$uid)out(['success'=>false,'error'=>'Нет доступа.'],403);
    $pdo->prepare("UPDATE rides SET pickup_requested_at=NULL,updated_at=? WHERE client_uuid=? AND status='accepted'")->execute([$now,$uuidIn]);
    out(['success'=>true,'server_data'=>serverData($pdo)]);

case 'confirm_pickup':
    $uid=requireAuth();requirePickupSchema($pdo);
    $uuidIn=trim((string)($in['client_uuid']??''));
    $st=$pdo->prepare("SELECT * FROM rides WHERE client_uuid=? AND deleted_at IS NULL");$st->execute([$uuidIn]);$ride=$st->fetch();
    if(!$ride)out(['success'=>false,'error'=>'Поездка не найдена.'],404);
    if((int)$ride['user_id']!==$uid)out(['success'=>false,'error'=>'Подтвердить подбор может только пассажир.'],403);
    if($ride['status']!=='accepted')out(['success'=>false,'error'=>'Поездка уже не в статусе ожидания подбора.'],409);
    if(empty($ride['pickup_requested_at']))out(['success'=>false,'error'=>'Водитель ещё не отметил подбор.'],409);
    $now=date('Y-m-d H:i:s');
    $pdo->prepare("UPDATE rides SET status='on_the_way',pickup_confirmed_at=?,updated_at=? WHERE client_uuid=? AND status='accepted'")->execute([$now,$now,$uuidIn]);
    out(['success'=>true,'server_data'=>serverData($pdo)]);

case 'force_pickup':
    $uid=requireAuth();requirePickupSchema($pdo);
    if(($_SESSION['role']??'')!=='driver')out(['success'=>false,'error'=>'Нужен режим водителя.'],403);
    $uuidIn=trim((string)($in['client_uuid']??''));
    $st=$pdo->prepare("SELECT * FROM rides WHERE client_uuid=? AND deleted_at IS NULL");$st->execute([$uuidIn]);$ride=$st->fetch();
    if(!$ride||(int)$ride['driver_id']!==$uid)out(['success'=>false,'error'=>'Поездка не найдена.'],404);
    if($ride['status']!=='accepted')out(['success'=>false,'error'=>'Поездка уже начата или закрыта.'],409);
    if(empty($ride['pickup_requested_at']))out(['success'=>false,'error'=>'Сначала отправьте пассажиру запрос на подтверждение.'],409);
    $wait=time()-strtotime((string)$ride['pickup_requested_at']);$grace=pickupGraceSeconds();
    if($wait<$grace)out(['success'=>false,'error'=>'Пассажир ещё может подтвердить. Начать поездку без подтверждения можно через '.max(1,(int)ceil(($grace-$wait)/60)).' мин.','wait_seconds'=>$grace-$wait],409);
    $now=date('Y-m-d H:i:s');
    $pdo->prepare("UPDATE rides SET status='on_the_way',updated_at=? WHERE client_uuid=? AND status='accepted'")->execute([$now,$uuidIn]);
    out(['success'=>true,'server_data'=>serverData($pdo)]);

case 'gigachat_ride_finder':
    $uid=requireAuth();
    if(!tableExists($pdo,'future_trips'))out(['success'=>true,'assistant'=>'Будущих поездок пока нет.','candidates'=>[]]);
    $message=trim((string)($in['message']??''));
    if($message==='')out(['success'=>false,'error'=>'Напишите, куда и примерно когда вы хотите поехать.'],422);
    $history=is_array($in['history']??null)?$in['history']:[];
    $history=array_slice(array_values(array_filter($history,fn($m)=>is_array($m)&&in_array(($m['role']??''),['user','assistant'],true))),-8);
    // Берём достаточно широкий пул будущих поездок. Город по умолчанию — Екатеринбург.
    $st=$pdo->prepare("SELECT t.id,t.driver_id,t.origin,t.destination,t.origin_lat,t.origin_lng,t.destination_lat,t.destination_lng,t.departure_at,t.seats_total,u.username driver_name,u.full_name driver_full_name,u.avatar_url driver_avatar,u.rating driver_rating,(SELECT COUNT(*) FROM trip_bookings b WHERE b.trip_id=t.id AND b.status='booked') booked_seats,(SELECT b2.id FROM trip_bookings b2 WHERE b2.trip_id=t.id AND b2.user_id=? AND b2.status='booked' LIMIT 1) my_booking_id FROM future_trips t JOIN users u ON u.id=t.driver_id WHERE t.status='open' AND t.departure_at>=NOW() AND t.driver_id<>? ORDER BY t.departure_at ASC LIMIT 250");$st->execute([$uid,$uid]);$rows=$st->fetchAll();
    $candidates=[];$seen=[];
    foreach($rows as $r){
        $id=(int)$r['id'];if(isset($seen[$id]))continue;$seen[$id]=true;
        $candidates[]=['id'=>$id,'driver_id'=>(int)$r['driver_id'],'driver_name'=>(string)$r['driver_name'],'driver_full_name'=>(string)($r['driver_full_name']??''),'driver_avatar'=>(string)($r['driver_avatar']??''),'driver_rating'=>(float)($r['driver_rating']??0),'origin'=>(string)$r['origin'],'destination'=>(string)$r['destination'],'departure_at'=>(string)$r['departure_at'],'origin_lat'=>$r['origin_lat']!==null?(float)$r['origin_lat']:null,'origin_lng'=>$r['origin_lng']!==null?(float)$r['origin_lng']:null,'destination_lat'=>$r['destination_lat']!==null?(float)$r['destination_lat']:null,'destination_lng'=>$r['destination_lng']!==null?(float)$r['destination_lng']:null,'free_seats'=>max(0,(int)$r['seats_total']-(int)$r['booked_seats']),'my_booking_id'=>$r['my_booking_id']!==null?(int)$r['my_booking_id']:null];
    }
    if(!$candidates)out(['success'=>true,'assistant'=>'Подходящих будущих поездок пока нет. Попробуйте другой день или время.','candidates'=>[]]);
    $compact=array_map(fn($c)=>['id'=>$c['id'],'driver'=>$c['driver_name'],'origin'=>$c['origin'],'destination'=>$c['destination'],'departure_at'=>$c['departure_at'],'free_seats'=>$c['free_seats']],$candidates);
    $system='Ты — помощник URFU4TOUR. Город по умолчанию — Екатеринбург, Россия, если пользователь явно не назвал другой город. Ищи поездки только среди CANDIDATES. Основные критерии: место назначения, затем близость даты и времени. Можно вернуть несколько разных подходящих водителей, отсортированных от наиболее близкого совпадения до менее близкого. НЕ зацикливайся на одном маршруте: если есть несколько разных поездок или водителей, включай их. Не выдумывай данные. Формат строго JSON без markdown: {"reply":"короткий ответ по-русски","ranked_ids":[числовые id от лучшего к худшему, максимум 5],"reason_by_id":{"123":"почему подходит"}}. Если ничего не подходит, ranked_ids: [].';
    $msgs=[['role'=>'system','content'=>$system],['role'=>'user','content'=>'CANDIDATES='.json_encode($compact,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]];
    foreach($history as $m)$msgs[]=['role'=>$m['role'],'content'=>mb_substr((string)($m['content']??''),0,1500)];
    $msgs[]=['role'=>'user','content'=>$message];
    try{$raw=gigachatComplete($config,$runtimeDir,$msgs);$parsed=extractJsonObject($raw);}catch(Throwable $e){logPrivate('GIGACHAT FINDER: '.$e->getMessage(),$runtimeDir);out(['success'=>false,'error'=>$e->getMessage()],502);}
    $byId=[];foreach($candidates as $c)$byId[(string)$c['id']]=$c;
    $rank=array_values(array_unique(array_filter(array_map('intval',(array)($parsed['ranked_ids']??[])),fn($id)=>isset($byId[(string)$id]))));
    $rank=array_slice($rank,0,5);
    // Если модель вернула мало результатов, добавляем следующие уникальные поездки из пула, не дублируя уже выбранные.
    foreach($candidates as $c){if(count($rank)>=5)break;$id=(int)$c['id'];if(!in_array($id,$rank,true))$rank[]=$id;}
    $ordered=[];
    foreach($rank as $id){$c=$byId[(string)$id];$c['reason']=(string)($parsed['reason_by_id'][(string)$id]??'Подходит по направлению и времени.');$ordered[]=$c;}
    $reply=(string)($parsed['reply']??'Вот наиболее подходящие варианты.');out(['success'=>true,'assistant'=>$reply,'candidates'=>$ordered]);

case 'sync': requireAuth();out(['success'=>true,'server_data'=>serverData($pdo),'csrf_token'=>csrf()]);
default: out(['success'=>false,'error'=>'Неизвестное действие'],400);
}
