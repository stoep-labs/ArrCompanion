using MediaBrowser.Model.Plugins;

namespace ArrCompanion
{
    public class PluginConfiguration : BasePluginConfiguration
    {
        public string SonarrUrl { get; set; } = "";
        public string SonarrApiKey { get; set; } = "";
        public string RadarrUrl { get; set; } = "";
        public string RadarrApiKey { get; set; } = "";
        // The root folder last picked in the Add dialog (kept by the server, not by the page).
        public string SonarrLastRootFolderPath { get; set; } = "";
        public string RadarrLastRootFolderPath { get; set; } = "";
    }
}
