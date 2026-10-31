import SwiftUI
import UIKit
import ComposeApp

/// Hosts the shared Compose UI (composeApp/src/iosMain/.../MainViewController.kt).
struct ComposeView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        MainViewControllerKt.MainViewController()
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}

struct ContentView: View {
    var body: some View {
        // Compose handles safe areas and the keyboard itself.
        ComposeView()
            .ignoresSafeArea()
            // The app is light only (ink on paper): keep dark status bar text even in Dark Mode.
            .preferredColorScheme(.light)
    }
}
