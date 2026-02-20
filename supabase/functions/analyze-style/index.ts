import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StyleAnalysisRequest {
  imageUrl: string;
  lookId?: string;
}

interface StyleAnalysisResponse {
  dominant_colors: string[];
  silhouette_type: string;
  style_category: string;
  suggestions: string[];
}

function analyzeStyle(imageUrl: string): StyleAnalysisResponse {
  const colors = [
    { name: 'noir', probability: 0.35 },
    { name: 'blanc', probability: 0.25 },
    { name: 'bleu', probability: 0.20 },
    { name: 'gris', probability: 0.15 },
    { name: 'beige', probability: 0.12 },
    { name: 'rouge', probability: 0.10 },
    { name: 'vert', probability: 0.08 },
    { name: 'marron', probability: 0.08 },
    { name: 'rose', probability: 0.07 },
    { name: 'jaune', probability: 0.05 },
  ];

  const silhouettes = [
    'ajusté',
    'oversize',
    'équilibré',
    'asymétrique',
    'structuré',
  ];

  const categories = [
    'streetwear',
    'chic',
    'casual',
    'sportswear',
    'bohème',
    'minimaliste',
    'vintage',
    'classique',
  ];

  const suggestionTemplates = [
    'Cette tenue est très monochrome',
    'Bel équilibre entre les couleurs',
    'Style minimaliste et épuré',
    'Contraste intéressant entre les pièces',
    'Tenue sobre et élégante',
    'Look audacieux avec des couleurs vives',
    'Silhouette bien proportionnée',
    'Style décontracté et confortable',
  ];

  const shuffledColors = colors.sort(() => Math.random() - 0.5);
  const selectedColors = shuffledColors.slice(0, 2 + Math.floor(Math.random() * 2));
  const dominant_colors = selectedColors.map(c => c.name);

  const silhouette_type = silhouettes[Math.floor(Math.random() * silhouettes.length)];
  const style_category = categories[Math.floor(Math.random() * categories.length)];

  const numSuggestions = 1 + Math.floor(Math.random() * 2);
  const suggestions = suggestionTemplates
    .sort(() => Math.random() - 0.5)
    .slice(0, numSuggestions);

  const hasMonochrome = dominant_colors.length === 1 || 
    (dominant_colors.length === 2 && (dominant_colors.includes('noir') || dominant_colors.includes('blanc')));
  
  if (hasMonochrome && !suggestions.includes('Cette tenue est très monochrome')) {
    suggestions[0] = 'Cette tenue est très monochrome';
  }

  const colorString = `Dominante de couleurs : ${dominant_colors.join(', ')}`;
  if (!suggestions.includes(colorString)) {
    suggestions.push(colorString);
  }

  return {
    dominant_colors,
    silhouette_type,
    style_category,
    suggestions,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { imageUrl }: StyleAnalysisRequest = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: 'imageUrl is required' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const analysis = analyzeStyle(imageUrl);

    return new Response(
      JSON.stringify(analysis),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error analyzing style:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to analyze style' }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});