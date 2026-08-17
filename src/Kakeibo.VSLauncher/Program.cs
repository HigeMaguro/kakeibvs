using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;

class Program
{
    static async Task<int> Main(string[] args)
    {
        try
        {
            var appRoot = FindAppRoot();
            if (appRoot == null)
            {
                Console.Error.WriteLine("package.json が見つかりません。プロジェクトディレクトリで実行してください。");
                return 1;
            }

            Console.WriteLine($"App root: {appRoot}");

            // 環境変数
            var port = "9090";
            var dataDir = Path.Combine(appRoot, "data");
            Directory.CreateDirectory(dataDir);
            var dbPath = Path.Combine(dataDir, "kakeibo.db");

            // NOTE: `npm run dev` is just `node --watch server.js` (see package.json).
            // We launch node directly to avoid fragile npm.cmd %~dp0 resolution
            // when started via Process.Start(UseShellExecute=false) on Windows.
            var psi = new ProcessStartInfo()
            {
                FileName = OperatingSystem.IsWindows() ? "node.exe" : "node",
                Arguments = "--watch server.js",
                WorkingDirectory = appRoot,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = false,
            };
            psi.Environment["APP_PORT"] = port;
            psi.Environment["DB_PATH"] = dbPath;
            psi.Environment["NODE_ENV"] = "development";

            var proc = Process.Start(psi);
            if (proc == null)
            {
                Console.Error.WriteLine("node プロセスを開始できませんでした。Node.js がインストールされていることを確認してください。");
                return 1;
            }

            // 非同期で出力を表示
            _ = Task.Run(async () =>
            {
                var reader = proc.StandardOutput;
                string? line;
                while ((line = await reader.ReadLineAsync()) != null)
                {
                    Console.WriteLine(line);
                }
            });
            _ = Task.Run(async () =>
            {
                var reader = proc.StandardError;
                string? line;
                while ((line = await reader.ReadLineAsync()) != null)
                {
                    Console.Error.WriteLine(line);
                }
            });

            // 少し待ってブラウザを開く
            await Task.Delay(1500);
            OpenBrowser($"http://localhost:{port}");

            Console.WriteLine("Press Ctrl+C to stop. Waiting for node process to exit...");

            await proc.WaitForExitAsync();
            Console.WriteLine($"node process exited with code {proc.ExitCode}");
            return proc.ExitCode;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.ToString());
            return 1;
        }
    }

    static string? FindAppRoot()
    {
        var dir = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (dir != null)
        {
            var package = Path.Combine(dir.FullName, "package.json");
            if (File.Exists(package)) return dir.FullName;
            dir = dir.Parent;
        }
        return null;
    }

    static void OpenBrowser(string url)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true
            };
            Process.Start(psi);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"ブラウザを開けませんでした: {ex.Message}");
        }
    }
}
