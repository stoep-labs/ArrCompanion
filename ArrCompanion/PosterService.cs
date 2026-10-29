using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Net;
using MediaBrowser.Controller.Providers;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Logging;
using MediaBrowser.Model.Providers;
using MediaBrowser.Model.Services;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace ArrCompanion
{
    // Posters for the Missing tab. The titles are not in the library, so Emby's own metadata search
    // (the same one as Identify, e.g. TheMovieDb) is asked for each one by its IMDb / TMDb / TVDb id.
    [Route("/ArrCompanion/Posters", "POST")]
    [Authenticated]
    public class AcPostersRequest : IReturn<AcPostersResponse>
    {
        public List<AcStatusItem> Items { get; set; } = new List<AcStatusItem>();
    }

    public class AcPostersResponse
    {
        public List<string> Urls { get; set; } = new List<string>();
    }

    public class AcPosterService : IService
    {
        private const int MaxItemsPerRequest = 60;
        private static readonly SemaphoreSlim Gate = new SemaphoreSlim(4);
        // Poster URL by "type|imdb|tmdb|tvdb" ("" = none found). Kept for the server's lifetime.
        private static readonly ConcurrentDictionary<string, string> Cache = new ConcurrentDictionary<string, string>();

        private readonly IProviderManager _providers;
        private readonly ILogger _log;

        public AcPosterService(IProviderManager providerManager, ILogManager logManager)
        {
            _providers = providerManager;
            _log = logManager.GetLogger("ArrCompanion");
        }

        public async Task<object> Post(AcPostersRequest request)
        {
            var items = (request.Items ?? new List<AcStatusItem>()).Take(MaxItemsPerRequest).ToList();
            var urls = await Task.WhenAll(items.Select(Poster)).ConfigureAwait(false);
            return new AcPostersResponse { Urls = urls.ToList() };
        }

        private async Task<string> Poster(AcStatusItem it)
        {
            var isShow = string.Equals(it.Type, "show", StringComparison.OrdinalIgnoreCase);
            var key = (isShow ? "show" : "movie") + "|" + it.Imdb + "|" + it.Tmdb + "|" + it.Tvdb;
            if (Cache.TryGetValue(key, out var hit)) return hit;

            var ids = new ProviderIdDictionary();
            if (!string.IsNullOrWhiteSpace(it.Imdb)) ids[MetadataProviders.Imdb.ToString()] = it.Imdb.Trim();
            if (!string.IsNullOrWhiteSpace(it.Tmdb)) ids[MetadataProviders.Tmdb.ToString()] = it.Tmdb.Trim();
            if (isShow && !string.IsNullOrWhiteSpace(it.Tvdb)) ids[MetadataProviders.Tvdb.ToString()] = it.Tvdb.Trim();
            if (ids.Count == 0) return Cache[key] = "";

            await Gate.WaitAsync().ConfigureAwait(false);
            try
            {
                if (Cache.TryGetValue(key, out hit)) return hit;
                IEnumerable<RemoteSearchResult> results;
                if (isShow)
                    results = await _providers.GetRemoteSearchResults<Series, SeriesInfo>(
                        new RemoteSearchQuery<SeriesInfo> { SearchInfo = new SeriesInfo { ProviderIds = ids }, IncludeDisabledProviders = true },
                        CancellationToken.None).ConfigureAwait(false);
                else
                    results = await _providers.GetRemoteSearchResults<Movie, MovieInfo>(
                        new RemoteSearchQuery<MovieInfo> { SearchInfo = new MovieInfo { ProviderIds = ids }, IncludeDisabledProviders = true },
                        CancellationToken.None).ConfigureAwait(false);
                var url = (results ?? Enumerable.Empty<RemoteSearchResult>()).Select(r => r.ImageUrl).FirstOrDefault(u => !string.IsNullOrWhiteSpace(u)) ?? "";
                // TheMovieDb hands the original size: a grid poster needs far less.
                if (url.StartsWith("https://image.tmdb.org/t/p/original/", StringComparison.OrdinalIgnoreCase))
                    url = "https://image.tmdb.org/t/p/w342/" + url.Substring("https://image.tmdb.org/t/p/original/".Length);
                return Cache[key] = url;
            }
            catch (Exception ex)
            {
                // Not cached: a failed search is tried again next time.
                _log.Debug("ArrCompanion: no poster for " + key + ": " + ex.Message);
                return "";
            }
            finally { Gate.Release(); }
        }
    }
}
