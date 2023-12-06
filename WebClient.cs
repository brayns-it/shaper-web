using Microsoft.AspNetCore.StaticFiles;
using System.Diagnostics;
using System.Reflection;
using System.Text;

namespace Brayns.Shaper
{
    public enum ClientSource
    {
        None,
        Resource,
        FileSystem
    }

    public static class WebClient
    {
        private static ClientSource Source { get; set; }
        private static string DebugPath { get; set; } = "";

        public static void MapShaperClient(this WebApplication app)
        {
            app.MapGet("/{**path}", Dispatch);
        }

        private static void DetectSource()
        {
            if (Source != ClientSource.None) return;

            if (Debugger.IsAttached)
            {
                FileInfo fi = new(Assembly.GetExecutingAssembly().Location);
                var fn = fi.FullName.ToLower().Replace("\\", "/");
                int p = fn.IndexOf("/bin/debug/");
                if (p > -1)
                {
                    fn = fn.Substring(0, p);
                    int p2 = fn.LastIndexOf("/");
                    if (p2 > -1)
                    {
                        fn = fn.Substring(0, p2);
                        fn += "/shaperweb/wwwroot/";
                        if (Directory.Exists(fn))
                        {
                            DebugPath = fn;
                            Source = ClientSource.FileSystem;
                            return;
                        }
                    }
                }
            }

            Source = ClientSource.Resource;
        }

        private static async Task<bool> GetFromFileSystem(string path, Stream body)
        {
            var fn = DebugPath + path;
            if (!File.Exists(fn)) return false;

            FileStream fs = new FileStream(fn, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            await fs.CopyToAsync(body);
            fs.Close();

            return true;
        }

        private static async Task Dispatch(HttpContext ctx)
        {
            DetectSource();

            var path = ctx.Request.RouteValues["path"]?.ToString() ?? "index.html";
            bool exists = false;

            var mime = new FileExtensionContentTypeProvider();
            string? contentType;
            if (!mime.TryGetContentType(path, out contentType))
                contentType = "application/other";

            ctx.Response.ContentType = contentType;

            switch (Source)
            {
                case ClientSource.FileSystem:
                    exists = await GetFromFileSystem(path, ctx.Response.Body);
                    break;
            }

            if (!exists)
            {
                ctx.Response.StatusCode = 404;
                return;
            }
        }
    }
}
