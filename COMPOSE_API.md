# API Документация - Композиция изображений

## Эндпоинт: `/api/images/compose`

Объединяет несколько изображений в одно с помощью AI (Qwen image_edit).

### Метод
`POST`

### URL
```
http://localhost:3264/api/images/compose
```

### Заголовки
```
Content-Type: multipart/form-data
Authorization: Bearer YOUR_API_KEY (если настроены API ключи)
```

### Параметры (form-data)

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `files` | File[] | Да | Массив изображений (от 1 до 3 файлов) |
| `prompt` | String | Нет | Текстовое описание как объединить изображения. По умолчанию: "объедини изображения" |

### Пример запроса (JavaScript)

```javascript
const formData = new FormData();

// Добавляем файлы
formData.append('files', roomPhotoFile);  // File object
formData.append('files', lightPhotoFile); // File object

// Опционально: кастомный промпт
formData.append('prompt', 'добавь светильник в центр комнаты');

const response = await fetch('http://localhost:3264/api/images/compose', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result.url); // URL результата
```

### Пример запроса (cURL)

```bash
curl -X POST http://localhost:3264/api/images/compose \
  -F "files=@/path/to/room.jpg" \
  -F "files=@/path/to/light.png" \
  -F "prompt=объедини изображения"
```

### Пример запроса (Python)

```python
import requests

files = [
    ('files', open('room.jpg', 'rb')),
    ('files', open('light.png', 'rb'))
]

data = {'prompt': 'добавь светильник в комнату'}

response = requests.post(
    'http://localhost:3264/api/images/compose',
    files=files,
    data=data
)

result = response.json()
print(result['url'])
```

### Успешный ответ (200 OK)

```json
{
  "url": "https://cdn.qwenlm.ai/output/.../image.png?key=...",
  "success": true
}
```

### Ошибки

#### 400 Bad Request
```json
{
  "error": "files required"
}
```
Не переданы файлы.

```json
{
  "error": "max 3 files allowed"
}
```
Передано больше 3 файлов.

#### 500 Internal Server Error
```json
{
  "error": "Failed to upload files to OSS"
}
```
Ошибка загрузки файлов в Qwen OSS.

```json
{
  "error": "No image URL in response"
}
```
Qwen не вернул изображение (возможно, неподходящий промпт).

## Процесс работы

1. **Загрузка файлов** → Сервер получает файлы через multipart/form-data
2. **Загрузка в Qwen OSS** → Файлы загружаются в облачное хранилище Qwen
3. **Создание чата** → Создается новый чат с типом `image_edit`
4. **Генерация** → Qwen обрабатывает изображения с промптом
5. **Возврат результата** → URL готового изображения

## Ограничения

- Максимум **3 изображения** за раз
- Поддерживаемые форматы: **PNG, JPG, JPEG, GIF, WEBP, BMP**
- Максимальный размер файла: **10 MB**
- Время обработки: **~5-20 секунд**

## Примеры промптов

```
"объедини изображения"
"добавь светильник в комнату"
"разместить продукт на фоне"
"совместить оба изображения"
"поместить второе изображение в центр первого"
```

## Интеграция для 200lux.store

```javascript
async function visualizeLight(roomPhoto, lightProductUrl) {
  // 1. Скачать изображение светильника
  const lightBlob = await fetch(lightProductUrl).then(r => r.blob());
  const lightFile = new File([lightBlob], 'light.png', { type: 'image/png' });
  
  // 2. Создать композицию
  const formData = new FormData();
  formData.append('files', roomPhoto);
  formData.append('files', lightFile);
  formData.append('prompt', 'добавь светильник в интерьер комнаты, реалистично');
  
  const response = await fetch('http://your-server:3264/api/images/compose', {
    method: 'POST',
    body: formData
  });
  
  const { url } = await response.json();
  return url;
}
```

## Дополнительные эндпоинты

### Генерация изображения (без композиции)

**POST** `/api/images/generations`
```json
{
  "prompt": "modern ceiling light",
  "size": "1024x1024"
}
```

**POST** `/api/image`
```json
{
  "prompt": "modern ceiling light",
  "size": "1:1"
}
```

## Настройка

### Добавление токена

Создайте файл `session/tokens.json`:
```json
[
  {
    "id": "your-user-id",
    "token": "your-jwt-token",
    "invalid": false,
    "resetAt": null
  }
]
```

### Запуск сервера

```bash
npm install
node index.js
```

Сервер запустится на `http://localhost:3264`

## Troubleshooting

**Ошибка: "No valid token"**
- Проверьте наличие `session/tokens.json`
- Убедитесь что токен не истек

**Ошибка: "Failed to upload files to OSS"**
- Проверьте токен Qwen
- Убедитесь что файлы корректного формата

**Ошибка: "No image URL in response"**
- Попробуйте другой промпт
- Убедитесь что изображения загружены корректно
