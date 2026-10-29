using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Drawing;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace ArrCompanion
{
    public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages, IHasThumbImage
    {
        public override string Name => "ArrCompanion";

        public override Guid Id => new Guid("7e28ada3-edf0-4128-88dc-ee2a934866f5");

        public override string Description => "Sonarr and Radarr for the missing titles of Home Screen Companion.";

        public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
            : base(applicationPaths, xmlSerializer)
        {
            Instance = this;
        }

        public static Plugin Instance { get; private set; } = null!;

        public override void UpdateConfiguration(BasePluginConfiguration configuration)
        {
            // The root folders last picked in the Add dialog are the server's own record.
            if (configuration is PluginConfiguration incoming && Configuration is PluginConfiguration current)
            {
                incoming.SonarrLastRootFolderPath = current.SonarrLastRootFolderPath ?? "";
                incoming.RadarrLastRootFolderPath = current.RadarrLastRootFolderPath ?? "";
            }
            base.UpdateConfiguration(configuration);
        }

        public IEnumerable<PluginPageInfo> GetPages()
        {
            var names = GetType().Assembly.GetManifestResourceNames();
            var html = names.FirstOrDefault(r => r.EndsWith("configPage.html"));
            var js = names.FirstOrDefault(r => r.EndsWith("configPage.js"));
            if (html == null || js == null) return new List<PluginPageInfo>();
            return new[]
            {
                new PluginPageInfo
                {
                    Name = "ArrCompanion",
                    EmbeddedResourcePath = html,
                    EnableInMainMenu = true,
                    DisplayName = "ArrCompanion",
                    MenuIcon = "cloud_download"
                },
                new PluginPageInfo { Name = "ArrCompanionJS", EmbeddedResourcePath = js }
            };
        }

        public Stream GetThumbImage()
        {
            var asm = GetType().Assembly;
            var path = asm.GetManifestResourceNames().FirstOrDefault(r => r.EndsWith("thumb.png"));
            return (path != null ? asm.GetManifestResourceStream(path) : Stream.Null) ?? Stream.Null;
        }

        public ImageFormat ThumbImageFormat => ImageFormat.Png;
    }
}
