using MediaBrowser.Common;
using MediaBrowser.Controller.Net;
using MediaBrowser.Model.Services;
using System;
using System.Linq;

namespace ArrCompanion
{
    // Whether Home Screen Companion is installed, its version and its "Show missing titles"
    // setting, read from Emby's plugin list. The missing titles themselves come from HSC's own
    // endpoint (/HomeScreenCompanion/MissingTitles), which the page calls.
    [Route("/ArrCompanion/Hsc", "GET")]
    [Authenticated(Roles = "Admin")]
    public class AcHscRequest : IReturn<AcHscResponse> { }

    public class AcHscResponse
    {
        public bool Installed { get; set; }
        public string Version { get; set; } = "";
        public bool? ShowMissingTitles { get; set; }   // null = not readable from this HSC version
    }

    public class AcHscService : IService
    {
        internal static readonly Guid HscId = new Guid("7c10708f-43e4-4d69-923c-77d01802315b");

        private readonly IApplicationHost _host;

        public AcHscService(IApplicationHost host)
        {
            _host = host;
        }

        public object Get(AcHscRequest request)
        {
            var hsc = _host.Plugins.FirstOrDefault(p => p.Id == HscId);
            if (hsc == null) return new AcHscResponse();
            var response = new AcHscResponse { Installed = true, Version = hsc.Version?.ToString() ?? "" };
            try
            {
                var config = hsc.GetType().GetProperty("Configuration")?.GetValue(hsc);
                if (config?.GetType().GetProperty("ShowMissingTitles")?.GetValue(config) is bool on)
                    response.ShowMissingTitles = on;
            }
            catch (Exception) { }   // left unknown: the page then just reads the list
            return response;
        }
    }
}
