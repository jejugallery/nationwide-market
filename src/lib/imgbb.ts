export async function uploadToImgbb(base64Data: string): Promise<string> {
  let apiKey = process.env.IMGBB_API_KEY;

  if (!apiKey) {
    throw new Error('IMGBB_API_KEY environment variable is not defined.');
  }

  // Clean the API key (remove literal quotes, spaces, etc.)
  apiKey = apiKey.trim().replace(/^["']|["']$/g, '');

  // Remove the data URL prefix if it exists (e.g. data:image/png;base64,)
  const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');

  const formData = new FormData();
  formData.append('image', cleanBase64);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Imgbb API Error (status ${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const url = result.data?.url;

  if (!url) {
    throw new Error('Failed to retrieve image URL from Imgbb response.');
  }

  return url;
}
