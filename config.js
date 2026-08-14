/* =========================================================================
   CONFIGURATION SUPABASE — le seul fichier à modifier
   -------------------------------------------------------------------------
   Renseigne ci-dessous tes deux identifiants, trouvables dans Supabase :
   Project Settings → API
     • "Project URL"        → SUPABASE_URL
     • clé "anon public"    → SUPABASE_ANON_KEY

   Ces deux valeurs sont conçues pour être visibles côté navigateur : c'est
   normal et sans danger pour une application familiale. (Ne mets JAMAIS ici
   la clé "service_role", qui est secrète.)
   ========================================================================= */

var SUPABASE_URL      = "https://gknafcnmwngovvoyftjk.supabase.co";
var SUPABASE_ANON_KEY = "sb_publishable_MgdTE1Fs3NDN1r3kf4Q4HA_i709cyQb";

/* Recherche automatique d'affiches/infos pour Films, Séries et Animes.
   Colle ta clé TMDB "API Key (v3 auth)" ci-dessous (themoviedb.org → Paramètres → API).
   Facultatif : sans elle, la recherche fonctionne quand même pour les
   Livres/Mangas (Open Library) et Albums/Titres (Apple), mais pas pour les films/séries/animes. */
var TMDB_API_KEY = "51688c56a6338164bb6073d204315d4e";
