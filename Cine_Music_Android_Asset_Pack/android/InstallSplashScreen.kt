// Integration example: add the import and installSplashScreen() call to your launcher activity.
// Keep your existing activity base class, content and navigation.
import android.os.Bundle
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

// Inside your existing MainActivity:
// override fun onCreate(savedInstanceState: Bundle?) {
//     installSplashScreen()   // Must run BEFORE super.onCreate().
//     super.onCreate(savedInstanceState)
//     // Your existing setContent { ... } or setContentView(...)
// }
