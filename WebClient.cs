using Microsoft.AspNetCore.StaticFiles;
using System.Diagnostics;
using System.Reflection;
using System.Text;

namespace Brayns.Shaper
{
    public static class WebClient
    {
        private static string? _debugPath;
        public static string? DebugPath
        {
            get { return _debugPath; }
            set
            {
                _debugPath = value;
                if (_debugPath != null)
                {
                    _debugPath = _debugPath.Replace("\\", "/");
                    if (!_debugPath.EndsWith("/"))
                        _debugPath += "/";
                }
            }
        }

        public static void MapShaperClient(this WebApplication app)
        {
            app.MapGet("/client/{**path}", Dispatch);
        }

        public static void MapShaperDefault(this WebApplication app)
        {
            app.MapGet("/", DispatchDefault);
        }

        private static async Task DispatchDefault(HttpContext ctx)
        {
            ctx.Response.Redirect("/client");
        }

        private static async Task Dispatch(HttpContext ctx)
        {
            var path = ctx.Request.RouteValues["path"]?.ToString() ?? "index.html";

            Stream? content = null;

            if (DebugPath != null)
            {
                var fn = DebugPath + path;
                if (File.Exists(fn))
                    content = new FileStream(fn, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            }
            
            if (content == null)
            {
                string resourceName = "ShaperWeb.web.";
                int n = path.LastIndexOf("/");
                if (n > -1)
                {
                    resourceName += path.Substring(0, n).Replace("/", ".").Replace("-", "_");
                    resourceName += "." + path.Substring(n + 1);
                }
                else
                    resourceName += path;

                content = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName);
            }

            if (content != null)
            {
                var mime = new FileExtensionContentTypeProvider();
                string? contentType;
                if (!mime.TryGetContentType(path, out contentType))
                    contentType = "application/other";

                ctx.Response.ContentType = contentType;

                await content.CopyToAsync(ctx.Response.Body);
                content.Close();
            }
            else
            {
                ctx.Response.StatusCode = 404;
            }
        }
    }
}
